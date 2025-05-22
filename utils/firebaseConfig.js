import admin from 'firebase-admin';
//import config from '../config.js';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Load environment variables
config();

// Set up file paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to service account file
const serviceAccountPath = path.join(__dirname, '..', process.env.FIREBASE_CREDENTIAL);
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

// Initialize Firebase Admin with service account
const firebaseApp = initializeApp({
  credential: cert(serviceAccount),
  databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
});

const db = getFirestore(firebaseApp);

// Get collection prefix from environment (if not set, defaults to no prefix)
const collectionPrefix = process.env.FIREBASE_COLLECTION_PREFIX || '';

// Define collections with environment-specific prefix
export const imagesCollection = db.collection(`${collectionPrefix}images`);

// Export the Firebase app and database instances
export const app = firebaseApp;
export const firestore = db; 