import { Client } from 'square';
import { v4 as uuidv4 } from 'uuid';
import admin from 'firebase-admin';

// Initialize Firebase Admin SDK
try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
} catch (e) { console.error("Firebase Admin SDK initialization error:", e); }
const db = admin.firestore();

// Initialize Square Client
const squareClient = new Client({
  environment: 'production', // Use the raw string 'production'
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
});

export default async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    const { invoiceId } = req.body;
    if (!invoiceId) {
        return res.status(400).json({ error: 'Invoice ID is required.' });
    }
    try {
        const invoiceRef = db.collection("invoices").doc(invoiceId);
        const invoiceDoc = await invoiceRef.get();
        if (!invoiceDoc.exists) {
            return res.status(404).json({ error: 'Invoice not found.' });
        }
        const invoiceData = invoiceDoc.data();
        const response = await squareClient.checkoutApi.createPaymentLink({
            idempotencyKey: uuidv4(),
            order: {
                locationId: process.env.SQUARE_LOCATION_ID,
                lineItems: [{
                    name: `Payment for Invoice #${invoiceData.invoiceNumber}`,
                    quantity: "1",
                    basePriceMoney: {
                        amount: invoiceData.amount * 100,
                        currency: "USD",
                    },
                }],
                metadata: { invoiceId: invoiceId },
            },
        });
        res.status(200).json({ checkoutUrl: response.result.paymentLink.url });
    } catch (error) {
        console.error("API Error:", error);
        res.status(500).json({ error: 'Could not create payment link.' });
    }
};