document.addEventListener('DOMContentLoaded', () => {

    const API_URL = 'https://campus-share-2krg.onrender.com/';
    const appState = { isLoggedIn: false, currentUser: null, currentView: 'auth' };

    const DOM = {
        views: { auth: document.getElementById('auth-view'), main: document.getElementById('main-view'), dashboard: document.getElementById('dashboard-view'), notifications: document.getElementById('notifications-view') },
        auth: { form: document.getElementById('auth-form'), nameField: document.getElementById('name-field'), feedback: document.getElementById('auth-feedback'), switchBtn: document.getElementById('switch-auth-btn'), title: document.getElementById('auth-title'), subtitle: document.getElementById('auth-subtitle'), promptText: document.getElementById('auth-prompt-text'), submitBtn: document.getElementById('auth-submit-btn') },
        header: { userGreeting: document.getElementById('user-greeting'), logoutBtn: document.getElementById('logout-btn'), dashboardBtn: document.getElementById('dashboard-btn'), notificationsBtn: document.getElementById('notifications-btn'), notificationBadge: document.getElementById('notification-badge') },
        main: { addResourceBtn: document.getElementById('add-resource-btn'), resourceGrid: document.getElementById('resource-grid') },
        dashboard: { backToMainBtn: document.getElementById('back-to-main-btn'), myItemsList: document.getElementById('my-items-list'), borrowedItemsList: document.getElementById('borrowed-items-list') },
        notifications: { list: document.getElementById('notifications-list'), backToMainBtn: document.getElementById('back-to-main-from-notifs-btn') },
        resourceModal: { modal: document.getElementById('resource-modal'), form: document.getElementById('resource-form'), cancelBtn: document.getElementById('cancel-resource-btn'), submitBtn: document.getElementById('submit-resource-btn'), feedback: document.getElementById('resource-feedback') },
        toast: { element: document.getElementById('toast'), message: document.getElementById('toast-message') },
        loader: document.getElementById('loader'),
    };

    let isLoginMode = true;

    async function apiRequest(endpoint, method = 'GET', body = null) {
        showLoader();
        const options = { method, headers: {} };
        if (body) {
            if (body instanceof FormData) { options.body = body; } 
            else { options.headers['Content-Type'] = 'application/json'; options.body = JSON.stringify(body); }
        }
        try {
            const response = await fetch(`${API_URL}${endpoint}`, options);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: `HTTP error! Status: ${response.status}` }));
                throw new Error(errorData.error);
            }
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
                return await response.json();
            } else {
                return { success: true, message: "Operation successful" };
            }
        } catch (error) {
            console.error(`API Error:`, error);
            let errorMessage = error.message.includes('Failed to fetch') 
                ? 'Connection Error: Could not reach the server. Is it running?'
                : error.message;
            showToast(errorMessage, 'error');
            throw error;
        } finally {
            hideLoader();
        }
    }

    function showToast(message, type = 'success') {
        DOM.toast.message.textContent = message;
        DOM.toast.element.className = `toast-container ${type === 'error' ? 'error' : ''} show`;
        setTimeout(() => DOM.toast.element.classList.remove('show'), 3000);
    }

    function showLoader() { DOM.loader.classList.add('active'); }
    function hideLoader() { DOM.loader.classList.remove('active'); }

    function switchView(viewName) {
        appState.currentView = viewName;
        Object.values(DOM.views).forEach(v => v.classList.remove('active-view'));
        DOM.views[viewName].classList.add('active-view');
    }

    function renderResourceCard(resource) {
        const card = document.createElement('div');
        card.className = 'bg-white rounded-xl shadow-lg overflow-hidden flex flex-col card-hover animate-fade-in-up';

        const openURL = `${API_URL}/uploads/${resource.file}`;
        const downloadURL = `${API_URL}/api/resources/${resource.file}/download`;

        let borrowButtonHTML = '';
        if (resource.owner_id !== appState.currentUser.id) {
             if (resource.status === 'available') {
                borrowButtonHTML = `<button data-id="${resource.id}" class="request-btn mt-2 w-full text-center font-semibold py-2 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300 transition">Request Physical Item</button>`;
             } else {
                const statusText = resource.borrower_id === appState.currentUser.id ? 'On Loan to You' : 'On Loan';
                const bgColor = resource.borrower_id === appState.currentUser.id ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800';
                borrowButtonHTML = `<div class="mt-2 w-full text-center font-semibold py-2 rounded-lg ${bgColor}">${statusText}</div>`;
             }
        }
        
        const fileExtension = resource.original_filename.split('.').pop().toLowerCase();
        let imageHTML = '';
        if (['png', 'jpg', 'jpeg', 'gif'].includes(fileExtension)) {
            imageHTML = `<img src="${openURL}" alt="${resource.name}" class="w-full h-48 object-cover">`;
        } else {
            imageHTML = `<div class="w-full h-48 bg-gray-200 flex flex-col items-center justify-center p-4">
                <svg class="w-16 h-16 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                <span class="mt-2 text-sm font-semibold text-gray-700 break-all text-center">${resource.original_filename}</span>
            </div>`;
        }
        
        card.innerHTML = `
        ${imageHTML}
        <div class="p-4 flex flex-col flex-grow">
            <span class="text-sm text-gray-500 font-medium">${resource.category}</span>
            <h3 class="text-lg font-bold text-gray-800 mt-1">${resource.name}</h3>
            <p class="text-sm text-gray-600 mt-2 flex-grow">${resource.description}</p>
            <div class="text-xs text-gray-500 mt-4">Shared by: <span class="font-semibold">${resource.owner_name}</span></div>
            <div class="mt-4 pt-4 border-t border-gray-200">
                 <div class="flex space-x-2">
                    <a href="${openURL}" target="_blank" class="flex-1 text-center bg-teal-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-teal-600 transition">Open File</a>
                    <a href="${downloadURL}" class="flex-1 text-center bg-gray-700 text-white px-4 py-2 rounded-lg font-semibold hover:bg-gray-800 transition">Download</a>
                </div>
                ${borrowButtonHTML}
            </div>
        </div>`;
        DOM.main.resourceGrid.appendChild(card);
    }
    
    function renderDashboardItem(item, listElement) {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'bg-white p-4 rounded-lg shadow-md flex justify-between items-center';
        let statusHTML = '';
        if (listElement === DOM.dashboard.myItemsList) {
            statusHTML = `<span class="text-sm font-semibold ${item.status === 'available' ? 'text-green-600' : 'text-yellow-600'}">${item.status === 'available' ? 'Available' : `On loan to ${item.borrower_name}`}</span>`;
        } else {
            statusHTML = `<span class="text-sm text-gray-600">Lender: ${item.owner_name}</span>`;
        }
        itemDiv.innerHTML = `<div><h4 class="font-bold text-lg">${item.name}</h4><p class="text-sm text-gray-500">${item.category}</p></div>${statusHTML}`;
        listElement.appendChild(itemDiv);
    }

    function renderNotificationItem(notification) {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'p-4 border-b border-gray-200 flex justify-between items-center';
        const isActionable = notification.status === 'pending';
        const buttonHTML = isActionable ? `<div class="flex space-x-2"><button data-id="${notification.id}" data-action="approved" class="approve-btn px-3 py-1 bg-green-500 text-white text-sm rounded-md">Approve</button><button data-id="${notification.id}" data-action="denied" class="deny-btn px-3 py-1 bg-red-500 text-white text-sm rounded-md">Deny</button></div>` : `<span class="text-sm font-semibold text-gray-500 capitalize">${notification.status}</span>`;
        itemDiv.innerHTML = `<div><p><span class="font-bold">${notification.requester_name}</span> wants to borrow your item: <span class="font-bold">${notification.resource_name}</span>.</p><p class="text-xs text-gray-500">${new Date(notification.timestamp * 1000).toLocaleString()}</p></div>${buttonHTML}`;
        DOM.notifications.list.appendChild(itemDiv);
    }

    function updateUIBasedOnState() {
        if (appState.isLoggedIn) {
            DOM.header.userGreeting.textContent = `Hello, ${appState.currentUser.name}`;
            if (appState.currentView === 'auth') { loadMainView(); }
        } else { switchView('auth'); }
    }
    
    async function loadMainView() {
        switchView('main');
        DOM.main.resourceGrid.innerHTML = '';
        try {
            const resources = await apiRequest('/api/resources');
            if (resources.length > 0) { resources.forEach(renderResourceCard); } 
            else { DOM.main.resourceGrid.innerHTML = '<p class="col-span-full text-center text-gray-500 py-16">No resources have been shared yet. Be the first!</p>'; }
            await fetchNotifications();
        } catch (error) { DOM.main.resourceGrid.innerHTML = '<p class="col-span-full text-center text-red-500 bg-red-100 p-6 rounded-lg font-semibold">Could not load resources. Please ensure the backend server is running and refresh the page.</p>'; }
    }
    
    async function loadDashboardView() {
        switchView('dashboard');
        DOM.dashboard.myItemsList.innerHTML = '<p>Loading...</p>';
        DOM.dashboard.borrowedItemsList.innerHTML = '<p>Loading...</p>';
        try {
            const data = await apiRequest(`/api/users/${appState.currentUser.id}/dashboard`);
            DOM.dashboard.myItemsList.innerHTML = data.owned_items.length ? '' : '<p>You have not shared any items.</p>';
            data.owned_items.forEach(item => renderDashboardItem(item, DOM.dashboard.myItemsList));
            DOM.dashboard.borrowedItemsList.innerHTML = data.borrowed_items.length ? '' : '<p>You have not borrowed any items.</p>';
            data.borrowed_items.forEach(item => renderDashboardItem(item, DOM.dashboard.borrowedItemsList));
        } catch (error) { DOM.dashboard.myItemsList.innerHTML = '<p class="text-red-500">Could not load dashboard data.</p>'; }
    }
    
    async function fetchNotifications() {
        if (!appState.isLoggedIn) return [];
        try {
            const notifications = await apiRequest(`/api/users/${appState.currentUser.id}/notifications`);
            const pendingCount = notifications.filter(n => n.status === 'pending').length;
            DOM.header.notificationBadge.textContent = pendingCount;
            DOM.header.notificationBadge.classList.toggle('hidden', pendingCount === 0);
            return notifications;
        } catch (error) { DOM.header.notificationBadge.classList.add('hidden'); return []; }
    }
    
    async function loadNotificationsView() {
        switchView('notifications');
        DOM.notifications.list.innerHTML = '<p>Loading...</p>';
        try {
            const notifications = await fetchNotifications();
            DOM.notifications.list.innerHTML = notifications.length ? '' : '<p class="text-center text-gray-500 p-8">You have no notifications.</p>';
            notifications.forEach(renderNotificationItem);
        } catch (error) { DOM.notifications.list.innerHTML = '<p class="text-red-500">Could not load notifications.</p>'; }
    }

    function toggleAuthMode() {
        isLoginMode = !isLoginMode;
        DOM.auth.form.reset(); DOM.auth.feedback.textContent = '';
        DOM.auth.title.textContent = isLoginMode ? 'Welcome Back!' : 'Create an Account';
        DOM.auth.subtitle.textContent = isLoginMode ? 'Login to continue to CampusShare' : 'Join the community by creating an account';
        DOM.auth.nameField.classList.toggle('hidden', isLoginMode);
        DOM.auth.submitBtn.textContent = isLoginMode ? 'Login' : 'Create Account';
        DOM.auth.promptText.textContent = isLoginMode ? "Don't have an account?" : "Already have an account?";
        DOM.auth.switchBtn.textContent = isLoginMode ? 'Sign Up' : 'Login';
    }
    
    function logout() {
        appState.isLoggedIn = false; appState.currentUser = null;
        localStorage.removeItem('campusShareUser');
        showToast("You have been logged out."); updateUIBasedOnState();
    }

    function init() {
        const savedUser = localStorage.getItem('campusShareUser');
        if (savedUser) { appState.isLoggedIn = true; appState.currentUser = JSON.parse(savedUser); }
        updateUIBasedOnState();
    }

    DOM.auth.switchBtn.addEventListener('click', toggleAuthMode);
    DOM.auth.form.addEventListener('submit', async e => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(DOM.auth.form).entries());
        const endpoint = isLoginMode ? '/api/login' : '/api/register';
        DOM.auth.feedback.textContent = '';
        try {
            const result = await apiRequest(endpoint, 'POST', data);
            appState.isLoggedIn = true; appState.currentUser = result.user;
            localStorage.setItem('campusShareUser', JSON.stringify(result.user));
            showToast(result.message); updateUIBasedOnState();
        } catch (error) { DOM.auth.feedback.textContent = error.message; }
    });
    
    DOM.header.logoutBtn.addEventListener('click', logout);
    DOM.header.dashboardBtn.addEventListener('click', loadDashboardView);
    DOM.header.notificationsBtn.addEventListener('click', loadNotificationsView);
    DOM.dashboard.backToMainBtn.addEventListener('click', loadMainView);
    DOM.notifications.backToMainBtn.addEventListener('click', loadMainView);

    DOM.main.addResourceBtn.addEventListener('click', () => DOM.resourceModal.modal.classList.add('active'));
    DOM.resourceModal.cancelBtn.addEventListener('click', () => DOM.resourceModal.modal.classList.remove('active'));
    DOM.resourceModal.form.addEventListener('submit', async e => {
        e.preventDefault();
        const formData = new FormData(DOM.resourceModal.form);
        formData.append('owner_id', appState.currentUser.id);
        DOM.resourceModal.submitBtn.disabled = true; DOM.resourceModal.submitBtn.textContent = 'Sharing...';
        DOM.resourceModal.feedback.textContent = '';
        try {
            await apiRequest('/api/resources', 'POST', formData);
            showToast("Resource shared successfully!");
            DOM.resourceModal.modal.classList.remove('active');
            DOM.resourceModal.form.reset(); 
            await loadMainView();
        } catch (error) { DOM.resourceModal.feedback.textContent = error.message; } 
        finally { DOM.resourceModal.submitBtn.disabled = false; DOM.resourceModal.submitBtn.textContent = 'Share Item'; }
    });

    DOM.main.resourceGrid.addEventListener('click', async e => {
        if (e.target.classList.contains('request-btn')) {
            const resourceId = e.target.dataset.id;
            try {
                const result = await apiRequest(`/api/resources/${resourceId}/request`, 'POST', { requester_id: appState.currentUser.id });
                showToast(result.message); await loadMainView();
            } catch (error) { /* Handled by apiRequest */ }
        }
    });
    
    DOM.notifications.list.addEventListener('click', async e => {
       if (e.target.matches('.approve-btn, .deny-btn')) {
           const notifId = e.target.dataset.id;
           const action = e.target.dataset.action;
           try {
               const result = await apiRequest(`/api/notifications/${notifId}/respond`, 'POST', { action });
               showToast(result.message); await loadNotificationsView();
           } catch(error) { /* Handled by apiRequest */ }
       }
    });

    init();
});