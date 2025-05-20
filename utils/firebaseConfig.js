import { initializeApp } from 'firebase/app';
import { getFirestore, collection } from 'firebase/firestore';
import config from '../config.js';

// Initialize Firebase with configuration from config.js
const firebaseApp = initializeApp(config.firebase);
const db = getFirestore(firebaseApp);

// Define collections
export const imagesCollection = collection(db, 'images');

// Export the Firebase app and database instances
export const app = firebaseApp;
export const firestore = db; 