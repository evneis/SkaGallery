import { firestore, imagesCollection } from './firebaseConfig.js';

/**
 * Check if an image with the given filename already exists
 * @param {string} filename - The filename to check
 * @returns {Promise<boolean>} - True if image exists, false otherwise
 */
export async function checkImageExists(filename) {
  try {
    const snapshot = await imagesCollection.where('filename', '==', filename).limit(1).get();
    return !snapshot.empty;
  } catch (error) {
    console.error('Error checking for existing image:', error);
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
  // Check if image with same filename already exists
  if (metadata.filename) {
    const exists = await checkImageExists(metadata.filename);
    if (exists) {
      throw new Error(`Image with filename "${metadata.filename}" already exists`);
    }
  }

  const timestamp = Date.now();

  const imageRecord = {
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

/**
 * Delete image by filename
 * @param {string} filename - Image filename
 * @param {boolean} isTenor - True if image is a Tenor GIF, false otherwise
 * @returns {Promise<boolean>} - True if deleted, false if not found
 */
export async function deleteImageByFilename(filename, isTenor) {
  try {
    let deleted = false;
    
    if (isTenor) {
      // Query by filename field for Tenor GIFs
      const snapshot = await imagesCollection.where("filename", "==", filename).get();
      
      if (snapshot.empty) {
        return false;
      }
      
      // Delete all matching documents
      for (const doc of snapshot.docs) {
        await doc.ref.delete();
        deleted = true;
      }
    } else {
      // For regular images, we use the filename as document ID
      const docRef = imagesCollection.doc(filename);
      const doc = await docRef.get();
      
      if (!doc.exists) {
        return false;
      }
      
      await docRef.delete();
      deleted = true;
    }

    return deleted;
  } catch (error) {
    console.error('Error deleting image by filename:', error);
    throw error;
  }
} 