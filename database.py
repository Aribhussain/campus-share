import sqlite3
import os

DATABASE_FILE = 'campus_share.db'

def create_connection():
    """Create a database connection to the SQLite database."""
    conn = None
    try:
        conn = sqlite3.connect(DATABASE_FILE)
        print(f"[INFO] SQLite version: {sqlite3.version}")
    except sqlite3.Error as e:
        print(e)
    return conn

def create_table(conn, create_table_sql):
    """Create a table from the create_table_sql statement."""
    try:
        c = conn.cursor()
        c.execute(create_table_sql)
    except sqlite3.Error as e:
        print(e)

def setup_database():
    """
    Sets up the database by creating all necessary tables.
    This function should be run once.
    """
    if os.path.exists(DATABASE_FILE):
        print(f"[WARN] Database file '{DATABASE_FILE}' already exists. Setup will not run again.")
        return

    sql_create_users_table = """
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL
    );
    """

    sql_create_resources_table = """
    CREATE TABLE IF NOT EXISTS resources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        file TEXT NOT NULL,
        original_filename TEXT NOT NULL,
        owner_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'available',
        borrower_id INTEGER,
        FOREIGN KEY (owner_id) REFERENCES users (id),
        FOREIGN KEY (borrower_id) REFERENCES users (id)
    );
    """
    
    sql_create_notifications_table = """
    CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        owner_id INTEGER NOT NULL,
        requester_id INTEGER NOT NULL,
        resource_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, denied
        timestamp REAL NOT NULL,
        FOREIGN KEY (owner_id) REFERENCES users (id),
        FOREIGN KEY (requester_id) REFERENCES users (id),
        FOREIGN KEY (resource_id) REFERENCES resources (id)
    );
    """

    # Create a database connection
    conn = create_connection()

    # Create tables
    if conn is not None:
        create_table(conn, sql_create_users_table)
        create_table(conn, sql_create_resources_table)
        create_table(conn, sql_create_notifications_table)
        conn.close()
        print(f"[OK] Database '{DATABASE_FILE}' initialized successfully.")
    else:
        print("[ERROR] Could not create the database connection.")

if __name__ == '__main__':
    setup_database()
