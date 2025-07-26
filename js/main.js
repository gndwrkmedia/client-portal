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
            showDashboard();
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
        showSignupLink.addEventListener('click', (e) => { 
            e.preventDefault(); 
            loginView.classList.add('d-none'); 
            signupView.classList.remove('d-none'); 
        });
    }

    if (showLoginLink) {
        showLoginLink.addEventListener('click', (e) => { 
            e.preventDefault(); 
            signupView.classList.add('d-none'); 
            loginView.classList.remove('d-none'); 
        });
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

    if (navDashboard) navDashboard.addEventListener('click', (e) => { e.preventDefault(); showDashboard(); });
    if (navBilling) navBilling.addEventListener('click', (e) => { e.preventDefault(); showBilling(); });

    if (sendMessageBtn) {
        sendMessageBtn.addEventListener('click', () => {
            const messageText = messageInput.value.trim();
            if (messageText && currentProjectId) {
                db.collection('projects').doc(currentProjectId).collection('messages').add({
                    text: messageText,
                    senderId: auth.currentUser.uid,
                    senderName: auth.currentUser.displayName,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
                messageInput.value = '';
            }
        });
    }

    if (uploadFileBtn) {
        uploadFileBtn.addEventListener('click', () => {
            const file = fileInput.files[0];
            if (!file || !currentProjectId) return;
            const uploadTask = storage.ref(`projects/${currentProjectId}/${file.name}`).put(file);
            uploadTask.on('state_changed', null, err => console.error(err), () => {
                uploadTask.snapshot.ref.getDownloadURL().then(url => {
                    db.collection('projects').doc(currentProjectId).collection('files').add({
                        name: file.name, url, uploaderName: auth.currentUser.displayName,
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

    function showDashboard() {
        mainHeaderTitle.textContent = 'Dashboard';
        billingView.classList.add('d-none');
        dashboardView.classList.remove('d-none');
        projectDetailView.classList.add('d-none');
        projectsList.classList.remove('d-none');
        setActiveNav(navDashboard);
        if (auth.currentUser) {
            fetchProjects(auth.currentUser.uid);
        }
        if (messageUnsubscribe) messageUnsubscribe();
        if (fileUnsubscribe) fileUnsubscribe();
    }

    function showBilling() {
        mainHeaderTitle.textContent = 'Billing';
        dashboardView.classList.add('d-none');
        billingView.classList.remove('d-none');
        setActiveNav(navBilling);
        if (auth.currentUser) {
            fetchInvoices(auth.currentUser.uid);
        }
    }

    async function showProjectDetail(projectId) {
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
        const messagesRef = db.collection('projects').doc(projectId).collection('messages').orderBy('timestamp');
        messageUnsubscribe = messagesRef.onSnapshot(querySnapshot => {
            if (!messageHistory) return;
            messageHistory.innerHTML = '';
            querySnapshot.forEach(doc => {
                const message = doc.data();
                const messageDiv = document.createElement('div');
                const isCurrentUser = message.senderId === auth.currentUser.uid;
                const alignment = isCurrentUser ? 'd-flex justify-content-end' : 'd-flex justify-content-start';
                const bubbleColor = isCurrentUser ? 'bg-primary text-white' : 'bg-secondary text-white';
                messageDiv.className = `mb-2 ${alignment}`;
                messageDiv.innerHTML = `<div class="message-bubble ${bubbleColor}"><div class="fw-bold" style="font-size: 0.8rem;">${message.senderName}</div><div>${message.text}</div></div>`;
                messageHistory.appendChild(messageDiv);
            });
            messageHistory.scrollTop = messageHistory.scrollHeight;
        });
    }

    function displayFiles(projectId) {
        const filesRef = db.collection('projects').doc(projectId).collection('files').orderBy('timestamp', 'desc');
        fileUnsubscribe = filesRef.onSnapshot(querySnapshot => {
            if (!fileList) return;
            fileList.innerHTML = '';
            if (querySnapshot.empty) {
                fileList.innerHTML = '<li class="list-group-item">No files uploaded yet.</li>';
                return;
            }
            querySnapshot.forEach(doc => {
                const file = doc.data();
                const fileLi = document.createElement('li');
                fileLi.className = 'list-group-item d-flex justify-content-between align-items-center';
                fileLi.innerHTML = `<span>${file.name} <small class="text-muted">by ${file.uploaderName}</small></span> <a href="${file.url}" target="_blank" class="btn btn-sm btn-outline-primary">Download</a>`;
                fileList.appendChild(fileLi);
            });
        });
    }

    async function fetchProjects(userId) {
        const projectsRef = db.collection('projects').where('clientId', '==', userId);
        try {
            const snapshot = await projectsRef.get();
            projectsList.innerHTML = '<h4>Your Projects:</h4>';
            if (snapshot.empty) {
                projectsList.innerHTML += '<p>No projects found.</p>';
                return;
            }
            snapshot.forEach(doc => {
                const project = doc.data();
                const projectDiv = document.createElement('a');
                projectDiv.href = "#";
                projectDiv.className = 'card shadow-sm mb-3 text-decoration-none text-dark';
                projectDiv.innerHTML = `<div class="card-body"><h5 class="card-title fw-bold">${project.projectName}</h5><p class="card-text mb-0">Status: <span class="text-primary">${project.status}</span></p></div>`;
                projectDiv.addEventListener('click', (e) => { e.preventDefault(); showProjectDetail(doc.id); });
                projectsList.appendChild(projectDiv);
            });
        } catch (error) { console.error("Error fetching projects: ", error); }
    }

    async function fetchInvoices(userId) {
        if (!invoicesList) return;
        const invoicesRef = db.collection('invoices').where('clientId', '==', userId).orderBy('issueDate', 'desc');
        try {
            const snapshot = await invoicesRef.get();
            if (snapshot.empty) {
                invoicesList.innerHTML = '<tr><td colspan="5" class="text-center">No invoices found.</td></tr>';
                return;
            }
            invoicesList.innerHTML = '';
            snapshot.forEach(doc => {
                const invoice = doc.data();
                const statusColor = invoice.status === 'Paid' ? 'text-bg-success' : 'text-bg-danger';
                const issueDate = invoice.issueDate.toDate().toLocaleDateString();
                const amountFormatted = (typeof invoice.amount === 'number') ? invoice.amount.toFixed(2) : 'N/A';
                const payButtonHtml = invoice.status !== 'Paid'
                    ? `<button class="btn btn-primary btn-sm pay-now-btn" data-invoice-id="${doc.id}">Pay Now</button>`
                    : `<span class="text-success">${invoice.status}</span>`;

                const row = `
                    <tr>
                        <td>#${invoice.invoiceNumber}</td>
                        <td>${issueDate}</td>
                        <td>$${amountFormatted}</td>
                        <td><span class="badge ${statusColor}">${invoice.status}</span></td>
                        <td>${payButtonHtml}</td>
                    </tr>
                `;
                invoicesList.innerHTML += row;
            });
        } catch (error) {
            console.error("Error fetching invoices: ", error);
            invoicesList.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Could not load invoices.</td></tr>';
        }
    }
});