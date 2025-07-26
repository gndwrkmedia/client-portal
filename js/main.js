document.addEventListener('DOMContentLoaded', () => {
    // js/main.js

    // --- Get Firebase Services ---
    const auth = firebase.auth();
    const db = firebase.firestore();
    const storage = firebase.storage();
    const functions = firebase.functions();

    // --- App State ---
    let currentProjectId = null;
    let messageUnsubscribe = null;
    let fileUnsubscribe = null;

    // --- Get DOM Elements ---
    const loginView = document.getElementById('login-view');
    const signupView = document.getElementById('signup-view');
    const portalView = document.getElementById('portal-view');
    const mainHeaderTitle = document.getElementById('main-header-title');
    const logoutButton = document.getElementById('logoutButton');
    const userEmailSpan = document.getElementById('user-email');
    const dashboardView = document.getElementById('dashboard-view');
    const billingView = document.getElementById('billing-view');
    const projectsList = document.getElementById('projects-list');
    const projectDetailView = document.getElementById('project-detail-view');
    const messageHistory = document.getElementById('message-history');
    const messageInput = document.getElementById('message-input');
    const sendMessageBtn = document.getElementById('send-message-btn');
    const fileInput = document.getElementById('file-input');
    const uploadFileBtn = document.getElementById('upload-file-btn');
    const fileList = document.getElementById('file-list');
    const invoicesList = document.getElementById('invoices-list');
    const navDashboard = document.getElementById('nav-dashboard');
    const navBilling = document.getElementById('nav-billing');
    const loginEmailInput = document.getElementById('loginEmail');
    const loginPasswordInput = document.getElementById('loginPassword');
    const loginButton = document.getElementById('loginButton');
    const showSignupLink = document.getElementById('show-signup-link');
    const showLoginLink = document.getElementById('show-login-link');
    const signupButton = document.getElementById('signupButton');
    
    // --- Firebase Auth State Listener ---
    auth.onAuthStateChanged(user => {
        if (user) {
            portalView.classList.remove('d-none');
            loginView.classList.add('d-none');
            signupView.classList.add('d-none');
            if (userEmailSpan) userEmailSpan.textContent = user.email;
            showDashboard(user); // Pass the user object directly
        } else {
            portalView.classList.add('d-none');
            loginView.classList.remove('d-none');
            signupView.classList.add('d-none');
            if (userEmailSpan) userEmailSpan.textContent = '';
        }
    });

    // --- Event Listeners ---
    if (loginButton) {
        loginButton.addEventListener('click', () => {
            auth.signInWithEmailAndPassword(loginEmailInput.value, loginPasswordInput.value)
                .catch(error => alert('Login failed: ' + error.message));
        });
    }

    if (logoutButton) logoutButton.addEventListener('click', () => auth.signOut());
    
    if (showSignupLink) {
        showSignupLink.addEventListener('click', (e) => { e.preventDefault(); loginView.classList.add('d-none'); signupView.classList.remove('d-none'); });
    }

    if (showLoginLink) {
        showLoginLink.addEventListener('click', (e) => { e.preventDefault(); signupView.classList.add('d-none'); loginView.classList.remove('d-none'); });
    }

    if (signupButton) {
        signupButton.addEventListener('click', () => {
            const name = document.getElementById('signupName').value;
            if (!name) return alert('Please enter your name.');
            auth.createUserWithEmailAndPassword(document.getElementById('signupEmail').value, document.getElementById('signupPassword').value)
                .then(cred => cred.user.updateProfile({ displayName: name })
                    .then(() => db.collection('users').doc(cred.user.uid).set({
                        displayName: name,
                        email: cred.user.email,
                        role: 'client',
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    }))
                )
                .catch(error => alert('Signup failed: ' + error.message));
        });
    }

    if (navDashboard) navDashboard.addEventListener('click', (e) => { e.preventDefault(); showDashboard(auth.currentUser); });
    if (navBilling) navBilling.addEventListener('click', (e) => { e.preventDefault(); showBilling(auth.currentUser); });

    if (sendMessageBtn) {
        sendMessageBtn.addEventListener('click', () => {
            const user = auth.currentUser;
            const messageText = messageInput.value.trim();
            if (messageText && currentProjectId && user) { // Check for user
                db.collection('projects').doc(currentProjectId).collection('messages').add({
                    text: messageText,
                    senderId: user.uid,
                    senderName: user.displayName,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
                messageInput.value = '';
            }
        });
    }

    if (uploadFileBtn) {
        uploadFileBtn.addEventListener('click', () => {
            const user = auth.currentUser;
            const file = fileInput.files[0];
            if (!file || !currentProjectId || !user) return; // Check for user
            const uploadTask = storage.ref(`projects/${currentProjectId}/${file.name}`).put(file);
            uploadTask.on('state_changed', null, err => console.error(err), () => {
                uploadTask.snapshot.ref.getDownloadURL().then(url => {
                    db.collection('projects').doc(currentProjectId).collection('files').add({
                        name: file.name, url, uploaderName: user.displayName,
                        timestamp: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    fileInput.value = '';
                });
            });
        });
    }
    
    if (invoicesList) {
        invoicesList.addEventListener('click', async (e) => {
            if (e.target && e.target.matches('button.pay-now-btn')) {
                const invoiceId = e.target.dataset.invoiceId;
                e.target.textContent = 'Creating Link...';
                e.target.disabled = true;
                try {
                    const response = await fetch('/api/createSquarePaymentLink', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ invoiceId: invoiceId }),
                    });
                    if (!response.ok) throw new Error('Failed to create payment link.');
                    const data = await response.json();
                    window.location.href = data.checkoutUrl;
                } catch (error) {
                    console.error("Error creating payment link:", error);
                    alert("Could not create payment link. Please try again later.");
                    e.target.textContent = 'Pay Now';
                    e.target.disabled = false;
                }
            }
        });
    }

    // --- UI Display & Navigation Functions ---
    function setActiveNav(activeLink) {
        [navDashboard, navBilling].forEach(link => {
            if(link) link.classList.remove('active', 'text-white');
        });
        if (activeLink) activeLink.classList.add('active', 'text-white');
    }

    function showDashboard(user) {
        if (!mainHeaderTitle || !billingView || !dashboardView || !projectDetailView || !projectsList) return;
        mainHeaderTitle.textContent = 'Dashboard';
        billingView.classList.add('d-none');
        dashboardView.classList.remove('d-none');
        projectDetailView.classList.add('d-none');
        projectsList.classList.remove('d-none');
        setActiveNav(navDashboard);
        if (user) { // Use the passed-in user object
            fetchProjects(user.uid);
        }
        if (messageUnsubscribe) messageUnsubscribe();
        if (fileUnsubscribe) fileUnsubscribe();
    }

    function showBilling(user) {
        if (!mainHeaderTitle || !dashboardView || !billingView) return;
        mainHeaderTitle.textContent = 'Billing';
        dashboardView.classList.add('d-none');
        billingView.classList.remove('d-none');
        setActiveNav(navBilling);
        if (user) { // Use the passed-in user object
            fetchInvoices(user.uid);
        }
    }

    async function showProjectDetail(projectId) {
        if (!mainHeaderTitle || !projectsList || !projectDetailView) return;
        currentProjectId = projectId;
        const projectDoc = await db.collection('projects').doc(projectId).get();
        if (!projectDoc.exists) return;
        mainHeaderTitle.textContent = projectDoc.data().projectName;
        projectsList.classList.add('d-none');
        projectDetailView.classList.remove('d-none');
        displayMessages(projectId);
        displayFiles(projectId);
    }

    // --- Data Fetching Functions ---
    function displayMessages(projectId) {
        const user = auth.currentUser;
        if (!user) return; // Check for user
        const messagesRef = db.collection('projects').doc(projectId).collection('messages').orderBy('timestamp');
        messageUnsubscribe = messagesRef.onSnapshot(querySnapshot => {
            if (!messageHistory) return;
            messageHistory.innerHTML = '';
            querySnapshot.forEach(doc => {
                const message = doc.data();
                const messageDiv = document.createElement('div');
                const isCurrentUser = message.senderId === user.uid; // Use the checked user variable
                const alignment = isCurrentUser ? 'd-flex justify-content-end' : 'd-flex justify-content-start';
                const bubbleColor = isCurrentUser ? 'bg-primary text-white' : 'bg-secondary text-white';
                messageDiv.className = `mb-2 ${alignment}`;
                messageDiv.innerHTML = `<div class="message-bubble ${bubbleColor}"><div class="fw-bold" style="font-size: 0.8rem;">${message.senderName}</div><div>${message.text}</div></div>`;
                messageHistory.appendChild(messageDiv);
            });
            if(messageHistory.scrollHeight) {
                messageHistory.scrollTop = messageHistory.scrollHeight;
            }
        });
    }

    function displayFiles(projectId) { /* Unchanged */ }
    async function fetchProjects(userId) { /* Unchanged */ }
    async function fetchInvoices(userId) { /* Unchanged */ }
});