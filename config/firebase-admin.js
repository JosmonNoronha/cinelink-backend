const admin = require("firebase-admin");

let db = null;
let auth = null;
let initialized = false;

try {
  console.log("🔥 Initializing Firebase Admin SDK...");

  // Get credentials from environment variables
  const serviceAccount = {
    type: "service_account",
    project_id: process.env.FIREBASE_PROJECT_ID || "cinelink-7343e",
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  };

  // Validate required credentials
  const requiredFields = ["project_id", "private_key", "client_email"];
  const missingFields = requiredFields.filter(
    (field) => !serviceAccount[field]
  );

  if (missingFields.length > 0) {
    throw new Error(
      `Missing required Firebase credentials: ${missingFields.join(", ")}`
    );
  }

  // Initialize Firebase Admin if not already initialized
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
    console.log("✅ Firebase Admin App initialized");
  } else {
    console.log("ℹ️ Using existing Firebase Admin App");
  }

  // Get Firestore and Auth instances
  db = admin.firestore();
  auth = admin.auth();
  initialized = true;

  console.log("✅ Firebase Admin SDK ready");
  console.log(`📄 Project ID: ${serviceAccount.project_id}`);
  console.log(`📧 Client Email: ${serviceAccount.client_email}`);
} catch (error) {
  console.error("❌ Firebase Admin SDK initialization failed:", error.message);
  console.log("");
  console.log("💡 To fix this:");
  console.log("   1. Ensure all Firebase credentials are in .env file");
  console.log("   2. Check that private key is properly formatted");
  console.log("   3. Verify project ID matches your Firebase project");
  console.log("");
  console.log("⚠️ User-related endpoints will be disabled");

  // Set to null so other modules can check availability
  db = null;
  auth = null;
  initialized = false;
}

module.exports = {
  admin: initialized ? admin : null,
  db,
  auth,
  initialized,
};
