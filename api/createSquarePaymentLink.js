// Add a log to inspect the imported package
const squarePackage = require("square");

const { v4: uuidv4 } = require("uuid");
const admin = require("firebase-admin");

// Initialize Firebase Admin SDK
try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
} catch (e) {
  console.error("Firebase Admin SDK initialization error:", e);
}
const db = admin.firestore();

module.exports = async (req, res) => {
  console.log("--- RUNNING LATEST CODE CHECK ---");
  // Log the contents of the imported square package
  console.log("Square Package Contents:", JSON.stringify(squarePackage, null, 2));

  // Destructure the required parts from the logged package
  const { Client, Environment } = squarePackage;

  // Check if Environment is still undefined
  if (!Environment) {
    console.error("FATAL: Environment object is undefined in the imported square package.");
    return res.status(500).json({ error: 'Square SDK Environment not found.' });
  }

  // Initialize Square Client
  const squareClient = new Client({
    environment: Environment.Production,
    accessToken: process.env.SQUARE_ACCESS_TOKEN,
  });

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
        metadata: {
          invoiceId: invoiceId,
        },
      },
    });

    res.status(200).json({ checkoutUrl: response.result.paymentLink.url });
  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({ error: 'Could not create payment link.' });
  }
};