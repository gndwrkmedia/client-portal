const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY || "AIzaSyAlMtEylG6kSTr7cvY2_-vSd7gA62HjAaY",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "sessionsdenton.firebaseapp.com",
    projectId: process.env.FIREBASE_PROJECT_ID || "sessionsdenton",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "sessionsdenton.firebasestorage.app",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "85943355201",
    appId: process.env.FIREBASE_APP_ID || "1:85943355201:web:cdb81447dba0eff28e03c0"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Square Payments
const squareAppId = process.env.SQUARE_APP_ID || "sq0idp-yEtwzWoDIPQcpK4U2fkwtA";
const squareLocationId = process.env.SQUARE_LOCATION_ID || "L517RTRT26BG3";
let payments;

// Cloudflare R2 Configuration
const r2Endpoint = process.env.R2_ENDPOINT || "https://90225f931bc3786171f6f414582d7cbc.r2.cloudflarestorage.com";
const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID || "65bdae4bab9818545fc45b08303cbedc";
const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY || "a3f3627da31d5acf7892414a06e248f88105578105da8f4a45c76f6db4debd44";

// Toggle between login and register forms
function showRegister() {
    document.getElementById('login-form').classList.add('is-hidden');
    document.getElementById('register-form').classList.remove('is-hidden');
}

function showLogin() {
    document.getElementById('register-form').classList.add('is-hidden');
    document.getElementById('login-form').classList.remove('is-hidden');
}

// Handle Authentication
auth.onAuthStateChanged(user => {
    if (user) {
        document.getElementById('login-section').classList.add('is-hidden');
        document.getElementById('dashboard-section').classList.remove('is-hidden');
        document.getElementById('user-name').textContent = user.displayName || user.email;
        document.getElementById('dash-name').textContent = user.displayName || user.email;
        fetchUserData(user.uid);
    } else {
        document.getElementById('dashboard-section').classList.add('is-hidden');
        document.getElementById('login-section').classList.remove('is-hidden');
    }
});

// Login Form Submission
document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    try {
        await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        alert('Login failed: ' + error.message);
    }
});

// Register Form Submission
document.getElementById('register-form').addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        await db.collection('users').doc(userCredential.user.uid).set({
            email: email,
            membership: 'Not a member'
        });
    } catch (error) {
        alert('Registration failed: ' + error.message);
    }
});

// Sign Out
document.getElementById('sign-out').addEventListener('click', () => {
    auth.signOut();
});

// Fetch User Data
async function fetchUserData(uid) {
    try {
        const userDoc = await db.collection('users').doc(uid).get();
        if (userDoc.exists) {
            const data = userDoc.data();
            document.getElementById('membership-status').textContent = data.membership || 'Not a member';
            fetchBookings(uid);
        }
    } catch (error) {
        console.error('Error fetching user data:', error);
    }
}

// Fetch Bookings
async function fetchBookings(uid) {
    try {
        const bookingsSnapshot = await db.collection('bookings').where('userId', '==', uid).get();
        if (!bookingsSnapshot.empty) {
            const booking = bookingsSnapshot.docs[0].data();
            document.getElementById('booking-status').textContent = `Next: ${new Date(booking.date).toLocaleString()}`;
        }
    } catch (error) {
        console.error('Error fetching bookings:', error);
    }
}

// Initialize Square Payments
async function initializeSquare() {
    payments = Square.payments(squareAppId, squareLocationId);
    const card = await payments.card();
    await card.attach('#card-container');
    document.getElementById('pay-button').addEventListener('click', async () => {
        try {
            const result = await card.tokenize();
            if (result.status === 'OK') {
                // Send result.token to your server for payment processing
                alert('Payment token generated: ' + result.token);
            } else {
                alert('Payment failed: ' + result.errors[0].message);
            }
        } catch (error) {
            alert('Payment error: ' + error.message);
        }
    });
}

// Handle File Upload to Cloudflare R2
document.getElementById('upload-button').addEventListener('click', async () => {
    const files = document.getElementById('file-upload').files;
    if (!files.length) return alert('No files selected');
    try {
        const file = files[0];
        const url = `${r2Endpoint}/${file.name}`;
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `AWS ${r2AccessKeyId}:${r2SecretAccessKey}`,
                'Content-Type': file.type,
                'X-Amz-Storage-Class': 'STANDARD',
                'X-Amz-Expires': '604800' // 7 days expiration
            },
            body: file
        });
        if (response.ok) {
            const fileList = document.getElementById('file-list');
            fileList.innerHTML += `<p><a href="${url}" target="_blank">${file.name}</a> (Expires in 7 days)</p>`;
        } else {
            alert('File upload failed');
        }
    } catch (error) {
        alert('File upload error: ' + error.message);
    }
});

// Tab Navigation
document.querySelectorAll('.tabs li').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tabs li').forEach(t => t.classList.remove('is-active'));
        tab.classList.add('is-active');
        document.querySelectorAll('.tab-content').forEach(content => content.classList.add('is-hidden'));
        document.getElementById(tab.dataset.tab).classList.remove('is-hidden');
    });
});

// Initialize Square on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeSquare().catch(err => console.error('Square initialization failed:', err));
});

// Expose functions to global scope for HTML onclick
window.showRegister = showRegister;
window.showLogin = showLogin;