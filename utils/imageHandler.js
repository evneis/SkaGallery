import { firestore, imagesCollection } from './firebaseConfig.js';

// Counter document for tracking the next ID
const COUNTER_DOC_ID = 'image_counter';
const countersCollection = firestore.collection('counters');

/**
 * Initialize the counter document if it doesn't exist
 */
async function ensureCounterExists() {
  const counterRef = countersCollection.doc(COUNTER_DOC_ID);
  const counterSnap = await counterRef.get();
  
  if (!counterSnap.exists) {
    await counterRef.set({ nextId: 1 });
  }
}

// Ensure counter exists on module load
ensureCounterExists().catch(error => {
  console.error('Error initializing counter:', error);
});

/**
 * Get the next ID and increment the counter
 * @returns {Promise<number>} - The next ID
 */
async function getNextId() {
  const counterRef = countersCollection.doc(COUNTER_DOC_ID);
  
  try {
    let nextId = 1;
    
    await firestore.runTransaction(async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      
      if (!counterDoc.exists) {
        transaction.set(counterRef, { nextId: 2 });
        nextId = 1;
      } else {
        nextId = counterDoc.data().nextId;
        transaction.update(counterRef, { nextId: nextId + 1 });
      }
    });
    
    return nextId;
  } catch (error) {
    console.error('Error getting next ID:', error);
    throw error;
  }
}

/**
 * Save Discord CDN URL and metadata
 * @param {string} url - The Discord CDN URL
 * @param {Object} metadata - Image metadata
 * @returns {Promise<Object>} - The saved image record
 */
export async function saveImageUrl(url, metadata = {}) {
  const id = await getNextId();
  const timestamp = Date.now();
  
  const imageRecord = {
    id,
    url,
    timestamp,
    imageTags: [], // Initialize empty array for tags
    ...metadata
  };
  
  try {
    await imagesCollection.add(imageRecord);
    return imageRecord;
  } catch (error) {
    console.error('Error saving image to Firestore:', error);
    throw error;
  }
}

/**
 * Get a random image from the database
 * @returns {Promise<Object|null>} - Random image record or null if none exist
 */


/**
 * Get a random image ID from the database
 * @returns {Promise<string|null>} - Random image ID or null if none exist
 */
export async function getRandomImageId() {
  try {
    // Get all image IDs (in a production app with many images, 
    // you would implement a more efficient random selection)
    const snapshot = await imagesCollection.get();
    
    if (snapshot.empty) {
      return null;
    }
    
    // Get array of document IDs only
    const imageIds = snapshot.docs.map(doc => doc.id);
    
    // Get random ID
    const randomIndex = Math.floor(Math.random() * imageIds.length);
    return imageIds[randomIndex];
  } catch (error) {
    console.error('Error getting random image ID:', error);
    throw error;
  }
}

/**
 * Get all images in the database
 * @returns {Promise<Object[]>} - Array of image records
 */
export async function getAllImages() {
  try {
    const snapshot = await imagesCollection.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting all images:', error);
    throw error;
  }
}

/**
 * Get total count of images
 * @returns {Promise<number>} - Number of images
 */
export async function getImageCount() {
  try {
    const snapshot = await imagesCollection.get();
    return snapshot.size;
  } catch (error) {
    console.error('Error counting images:', error);
    throw error;
  }
}

/**
 * Get image by ID
 * @param {string} docId - Firestore document ID
 * @returns {Promise<Object|null>} - Image record or null if not found
 */
export async function getImageById(docId) {
  try {
    const doc = await imagesCollection.doc(docId).get();
    
    if (!doc.exists) {
      return null;
    }
    
    return { id: doc.id, ...doc.data() };
  } catch (error) {
    console.error('Error getting image by ID:', error);
    throw error;
  }
}

/**
 * Delete image by ID
 * @param {number} id - Image ID
 * @returns {Promise<boolean>} - True if deleted, false if not found
 */
export async function deleteImage(id) {
  try {
    const snapshot = await imagesCollection.where("id", "==", id).get();
    
    if (snapshot.empty) {
      return false;
    }
    
    const doc = snapshot.docs[0];
    await doc.ref.delete();
    return true;
  } catch (error) {
    console.error('Error deleting image:', error);
    throw error;
  }
} 