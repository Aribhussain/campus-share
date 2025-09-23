import sqlite3
import hashlib
import uuid
import os
import time
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename

# --- App Configuration ---
app = Flask(__name__)
CORS(app)
DATABASE = 'campus_share.db'
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'pdf', 'doc', 'docx', 'txt', 'ppt', 'pptx', 'xls', 'xlsx'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# --- Database Helpers ---
def get_db_connection():
    """Establishes a connection to the database and sets row_factory."""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row # This allows accessing columns by name, e.g., row['name']
    return conn

def hash_password(password):
    """Hashes a password using SHA256 for secure storage."""
    return hashlib.sha256(password.encode()).hexdigest()

def allowed_file(filename):
    """Checks if the file extension is in our allowed set."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# --- API Endpoints ---

# --- User Authentication ---
@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    name = data.get('name')
    email = data.get('email')
    password = data.get('password')

    if not all([name, email, password]):
        return jsonify({"error": "All fields are required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
    if cursor.fetchone():
        conn.close()
        return jsonify({"error": "Email is already registered"}), 409

    password_hash = hash_password(password)
    cursor.execute("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
                   (name, email, password_hash))
    user_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    print(f"[AUTH] New user registered: {name} (ID: {user_id})")
    # The frontend doesn't use the user object on register, but it's good practice
    return jsonify({
        "message": "Registration successful! Please log in.",
        "user": {"id": user_id, "name": name, "email": email}
    }), 201

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    if not all([email, password]):
        return jsonify({"error": "Email and password are required"}), 400

    conn = get_db_connection()
    user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    conn.close()

    if user and user['password_hash'] == hash_password(password):
        print(f"[AUTH] User login successful: {user['name']} (ID: {user['id']})")
        return jsonify({
            "message": f"Welcome back, {user['name']}!",
            "user": {"id": user['id'], "name": user['name'], "email": user['email']}
        }), 200
    
    print(f"[AUTH] Failed login attempt for email: {email}")
    return jsonify({"error": "Invalid email or password"}), 401

# --- Resource Management ---
@app.route('/api/resources', methods=['GET'])
def get_all_resources():
    conn = get_db_connection()
    query = """
    SELECT r.id, r.name, r.category, r.description, r.file, r.original_filename,
           r.status, r.owner_id, u_owner.name as owner_name, r.borrower_id,
           u_borrower.name as borrower_name
    FROM resources r
    JOIN users u_owner ON r.owner_id = u_owner.id
    LEFT JOIN users u_borrower ON r.borrower_id = u_borrower.id
    ORDER BY r.id DESC
    """
    resources = conn.execute(query).fetchall()
    conn.close()
    return jsonify([dict(row) for row in resources])

@app.route('/api/resources', methods=['POST'])
def create_resource():
    if 'file' not in request.files:
        return jsonify({"error": "File is required"}), 400
    
    file = request.files['file']
    if file.filename == '' or not allowed_file(file.filename):
        return jsonify({"error": "Invalid or no file selected"}), 400

    name = request.form.get('name')
    category = request.form.get('category')
    description = request.form.get('description')
    owner_id = request.form.get('owner_id')

    if not all([name, category, description, owner_id]):
        return jsonify({"error": "Missing required information"}), 400

    file_extension = file.filename.rsplit('.', 1)[1].lower()
    unique_filename = f"{uuid.uuid4()}.{file_extension}"
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
    file.save(file_path)
    print(f"[UPLOAD] File '{file.filename}' saved as '{unique_filename}'")

    conn = get_db_connection()
    conn.execute(
        "INSERT INTO resources (name, category, description, file, original_filename, owner_id) VALUES (?, ?, ?, ?, ?, ?)",
        (name, category, description, unique_filename, file.filename, owner_id)
    )
    conn.commit()
    conn.close()
    
    return jsonify({"message": "Resource shared successfully"}), 201

# --- Borrowing and Notifications ---
@app.route('/api/resources/<int:resource_id>/request', methods=['POST'])
def request_resource(resource_id):
    data = request.get_json()
    requester_id = data.get('requester_id')

    conn = get_db_connection()
    resource = conn.execute("SELECT * FROM resources WHERE id = ?", (resource_id,)).fetchone()
    
    if not resource or resource['status'] != 'available':
        conn.close()
        return jsonify({"error": "Resource not available for request"}), 400

    owner_id = resource['owner_id']
    conn.execute(
        "INSERT INTO notifications (owner_id, requester_id, resource_id, timestamp) VALUES (?, ?, ?, ?)",
        (owner_id, requester_id, resource_id, time.time())
    )
    conn.commit()
    conn.close()
    
    print(f"[REQUEST] User {requester_id} requested resource {resource_id} from owner {owner_id}")
    return jsonify({"message": "Request sent to the owner!"}), 200

@app.route('/api/notifications/<int:notification_id>/respond', methods=['POST'])
def respond_to_notification(notification_id):
    data = request.get_json()
    action = data.get('action')

    if action not in ['approved', 'denied']:
        return jsonify({"error": "Invalid action specified"}), 400
        
    conn = get_db_connection()
    notification = conn.execute("SELECT * FROM notifications WHERE id = ? AND status = 'pending'", (notification_id,)).fetchone()
    
    if not notification:
        conn.close()
        return jsonify({"error": "No pending notification found"}), 404

    conn.execute("UPDATE notifications SET status = ? WHERE id = ?", (action, notification_id))
    
    if action == 'approved':
        conn.execute("UPDATE resources SET status = 'on loan', borrower_id = ? WHERE id = ?",
                     (notification['requester_id'], notification['resource_id']))
    
    conn.commit()
    conn.close()
    
    print(f"[RESPONSE] Notification {notification_id} was {action}")
    return jsonify({"message": f"Request has been {action}"}), 200

# --- Dashboard & Notifications Views ---
@app.route('/api/users/<int:user_id>/notifications', methods=['GET'])
def get_notifications(user_id):
    conn = get_db_connection()
    query = """
    SELECT n.id, n.status, n.timestamp,
           r.name as resource_name,
           u.name as requester_name
    FROM notifications n
    JOIN resources r ON n.resource_id = r.id
    JOIN users u ON n.requester_id = u.id
    WHERE n.owner_id = ? ORDER BY n.timestamp DESC
    """
    notifications = conn.execute(query, (user_id,)).fetchall()
    conn.close()
    return jsonify([dict(row) for row in notifications])

@app.route('/api/users/<int:user_id>/dashboard', methods=['GET'])
def get_dashboard_data(user_id):
    conn = get_db_connection()
    owned_query = """
    SELECT r.*, u.name as borrower_name FROM resources r
    LEFT JOIN users u ON r.borrower_id = u.id WHERE r.owner_id = ?
    """
    owned_items = conn.execute(owned_query, (user_id,)).fetchall()
    
    borrowed_query = """
    SELECT r.*, u.name as owner_name FROM resources r
    JOIN users u ON r.owner_id = u.id WHERE r.borrower_id = ?
    """
    borrowed_items = conn.execute(borrowed_query, (user_id,)).fetchall()
    conn.close()
    
    return jsonify({
        "owned_items": [dict(row) for row in owned_items],
        "borrowed_items": [dict(row) for row in borrowed_items]
    })
    
# --- File Serving ---
@app.route('/uploads/<path:filename>')
def serve_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/api/resources/<path:filename>/download')
def download_file(filename):
    # This route is a convenience for the frontend, though browsers can handle most downloads
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename, as_attachment=True)

# --- Main Runner ---
if __name__ == '__main__':
    if not os.path.exists(UPLOAD_FOLDER):
        os.makedirs(UPLOAD_FOLDER)
    
    if not os.path.exists(DATABASE):
        print("\n" + "="*50)
        print("!!! DATABASE NOT FOUND !!!")
        print(f"Error: The database file '{DATABASE}' does not exist.")
        print("Please run 'python database.py' first to initialize it.")
        print("="*50 + "\n")
    else:
        print("🚀 Starting Flask backend server...")
        app.run(debug=True, port=5000)

