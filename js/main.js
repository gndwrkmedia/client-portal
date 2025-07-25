// js/main.js

// --- Get Firebase Services ---
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

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

// View Containers
const dashboardView = document.getElementById('dashboard-view');
const billingView = document.getElementById('billing-view');

// Dashboard Elements
const projectsList = document.getElementById('projects-list');
const projectDetailView = document.getElementById('project-detail-view');
const messageHistory = document.getElementById('message-history');
const messageInput = document.getElementById('message-input');
const sendMessageBtn = document.getElementById('send-message-btn');
const fileInput = document.getElementById('file-input');
const uploadFileBtn = document.getElementById('upload-file-btn');
const fileList = document.getElementById('file-list');

// Billing Elements
const invoicesList = document.getElementById('invoices-list');

// Nav Links
const navDashboard = document.getElementById('nav-dashboard');
const navBilling = document.getElementById('nav-billing');

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
document.getElementById('loginButton').addEventListener('click', () => {
    auth.signInWithEmailAndPassword(document.getElementById('loginEmail').value, document.getElementById('loginPassword').value)
        .catch(error => alert('Login failed: ' + error.message));
});

if (logoutButton) logoutButton.addEventListener('click', () => auth.signOut());

document.getElementById('show-signup-link').addEventListener('click', (e) => { e.preventDefault(); loginView.classList.add('d-none'); signupView.classList.remove('d-none'); });
document.getElementById('show-login-link').addEventListener('click', (e) => { e.preventDefault(); signupView.classList.add('d-none'); loginView.classList.remove('d-none'); });

document.getElementById('signupButton').addEventListener('click', () => {
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

navDashboard.addEventListener('click', (e) => { e.preventDefault(); showDashboard(); });
navBilling.addEventListener('click', (e) => { e.preventDefault(); showBilling(); });

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

// --- UI Display & Navigation Functions ---
function setActiveNav(activeLink) {
    [navDashboard, navBilling].forEach(link => link.classList.remove('active'));
    if (activeLink) activeLink.classList.add('active');
}

function showDashboard() {
    mainHeaderTitle.textContent = 'Dashboard';
    billingView.classList.add('d-none');
    dashboardView.classList.remove('d-none');
    projectDetailView.classList.add('d-none');
    projectsList.classList.remove('d-none');
    setActiveNav(navDashboard);
    fetchProjects(auth.currentUser.uid);
    if (messageUnsubscribe) messageUnsubscribe();
    if (fileUnsubscribe) fileUnsubscribe();
}

function showBilling() {
    mainHeaderTitle.textContent = 'Billing';
    dashboardView.classList.add('d-none');
    billingView.classList.remove('d-none');
    setActiveNav(navBilling);
    fetchInvoices(auth.currentUser.uid);
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
function displayMessages(projectId) { /* ... same as before ... */ }
function displayFiles(projectId) { /* ... same as before ... */ }

async function fetchProjects(userId) { /* ... same as before ... */ }

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
            const statusColor = invoice.status === 'Paid' ? 'success' : 'danger';
            const issueDate = invoice.issueDate.toDate().toLocaleDateString();
            const row = `
                <tr>
                    <td>#${invoice.invoiceNumber}</td>
                    <td>${issueDate}</td>
                    <td>$${invoice.amount.toFixed(2)}</td>
                    <td><span class="badge bg-${statusColor}">${invoice.status}</span></td>
                    <td>
                        ${invoice.status !== 'Paid' ? '<button class="btn btn-primary btn-sm">Pay Now</button>' : ''}
                    </td>
                </tr>
            `;
            invoicesList.innerHTML += row;
        });
    } catch (error) {
        console.error("Error fetching invoices: ", error);
        invoicesList.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Could not load invoices.</td></tr>';
    }
}