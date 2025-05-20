import admin from 'firebase-admin';
import config from '../config.js';

// Initialize Firebase Admin with service account credentials
const firebaseApp = admin.initializeApp({
  credential: admin.credential.cert(config.firebaseServiceAccount)
});

// Get Firestore database instance
const db = firebaseApp.firestore();

// Define collections
export const imagesCollection = db.collection('images');

// Export the Firebase app and database instances
export const app = firebaseApp;
export const firestore = db; 