import admin from "firebase-admin";
const serviceAccount = require("../serviceAccountKey.json") as any;

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as any),
});

export default admin;
