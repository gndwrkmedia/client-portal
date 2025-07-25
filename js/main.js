// js/main.js

// --- Get Firebase Services ---
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// --- App State, DOM Elements, Auth Listener, and other listeners are unchanged ---

// MODIFIED: Event listener for "Pay Now" buttons
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

            if (!response.ok) {
                throw new Error('Failed to create payment link.');
            }

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


// --- UI Display & Navigation Functions are unchanged ---

// --- Data Fetching Functions ---
// All other fetching functions (displayMessages, displayFiles, fetchProjects) are unchanged

// MODIFIED: fetchInvoices function
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
            
            // The "Pay Now" button now calls our Vercel function
            const payButtonHtml = invoice.status !== 'Paid' 
                ? `<button class="btn btn-primary btn-sm pay-now-btn" data-invoice-id="${doc.id}">Pay Now</button>` 
                : `<span class="text-success">${invoice.status}</span>`;

            const row = `
                <tr>
                    <td>#${invoice.invoiceNumber}</td>
                    <td>${issueDate}</td>
                    <td>$${invoice.amount.toFixed(2)}</td>
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