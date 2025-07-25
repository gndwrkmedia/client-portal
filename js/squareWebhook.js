const { Client, Environment, WebhooksHelper } = require('square');
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
} catch (e) { console.error('Firebase Admin SDK initialization error:', e); }
const db = admin.firestore();

// Initialize Square Client
const squareClient = new Client({
  environment: Environment.Production,
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
});

module.exports = async (req, res) => {
    // The rest of the function is correct
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    const signature = req.headers['x-square-signature'];
    const webhookUrl = 'https://client-portal-nu-rust.vercel.app/api/squareWebhook';
    const signatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
    try {
        const isValid = WebhooksHelper.isValidWebhookEventSignature(
            JSON.stringify(req.body), signature, signatureKey, webhookUrl
        );
        if (!isValid) {
            return res.status(401).send('Invalid signature');
        }
        const { type, data } = req.body;
        if (type === 'payment.updated') {
            const payment = data.object.payment;
            if (payment.status === 'COMPLETED' && payment.order_id) {
                const orderResponse = await squareClient.ordersApi.retrieveOrder(payment.order_id);
                const invoiceId = orderResponse.result.order.metadata.invoiceId;
                if (invoiceId) {
                    const invoiceRef = db.collection('invoices').doc(invoiceId);
                    await invoiceRef.update({ status: 'Paid' });
                    console.log(`Successfully updated invoice ${invoiceId} to Paid.`);
                }
            }
        }
        return res.status(200).send('Event received');
    } catch (error) {
        console.error('Error processing webhook:', error);
        return res.status(500).send('Webhook processing error');
    }
};