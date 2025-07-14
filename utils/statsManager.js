import { firestore } from './firebaseConfig.js';
import { imagesCollection } from './firebaseConfig.js';

// Get collection prefix from environment
const collectionPrefix = process.env.FIREBASE_COLLECTION_PREFIX || '';

// Define stats collections
export const userStatsCollection = firestore.collection(`${collectionPrefix}userStats`);
export const serverStatsCollection = firestore.collection(`${collectionPrefix}serverStats`);

/**
 * Initialize or update user stats when an image is uploaded
 * @param {Object} imageData - The image data being uploaded
 */
export async function updateUserStatsOnUpload(imageData) {
  const userId = imageData.author.id;
  const userStatsRef = userStatsCollection.doc(userId);
  
  try {
    await firestore.runTransaction(async (transaction) => {
      const userStatsDoc = await transaction.get(userStatsRef);
      
      if (!userStatsDoc.exists) {
        // First time user
        const newStats = {
          userId: userId,
          username: imageData.author.username,
          displayName: imageData.author.displayName,
          uploadCount: 1,
          totalSize: imageData.size,
          avgSize: imageData.size,
          firstUpload: imageData.timestamp,
          lastUpload: imageData.timestamp,
          contentTypes: {
            [getContentTypeLabel(imageData)]: 1
          },
          lastUpdated: Date.now()
        };
        transaction.set(userStatsRef, newStats);
      } else {
        // Update existing stats
        const currentStats = userStatsDoc.data();
        const newUploadCount = currentStats.uploadCount + 1;
        const newTotalSize = currentStats.totalSize + imageData.size;
        
        const updatedStats = {
          username: imageData.author.username, // Update in case it changed
          displayName: imageData.author.displayName,
          uploadCount: newUploadCount,
          totalSize: newTotalSize,
          avgSize: Math.round(newTotalSize / newUploadCount),
          lastUpload: imageData.timestamp,
          contentTypes: {
            ...currentStats.contentTypes,
            [getContentTypeLabel(imageData)]: (currentStats.contentTypes[getContentTypeLabel(imageData)] || 0) + 1
          },
          lastUpdated: Date.now()
        };
        
        transaction.update(userStatsRef, updatedStats);
      }
    });
    
    // Schedule server stats update (non-blocking)
    updateServerStatsAsync();
  } catch (error) {
    console.error('Error updating user stats:', error);
    throw error;
  }
}

/**
 * Get user statistics
 * @param {string} userId - Discord user ID
 * @returns {Object|null} User stats or null if not found
 */
export async function getUserStats(userId) {
  try {
    const userStatsDoc = await userStatsCollection.doc(userId).get();
    return userStatsDoc.exists ? userStatsDoc.data() : null;
  } catch (error) {
    console.error('Error getting user stats:', error);
    throw error;
  }
}

/**
 * Get server-wide statistics (cached for efficiency)
 * @returns {Object} Server statistics
 */
export async function getServerStats() {
  try {
    const serverStatsDoc = await serverStatsCollection.doc('global').get();
    if (serverStatsDoc.exists) {
      return serverStatsDoc.data();
    }
    
    // If no cached stats, calculate them
    console.log('No cached server stats found, calculating...');
    return await calculateAndCacheServerStats();
  } catch (error) {
    console.error('Error getting server stats:', error);
    throw error;
  }
}

/**
 * Calculate user ranking for a specific stat
 * @param {string} userId - Discord user ID
 * @param {string} statField - Field to rank by ('uploadCount', 'totalSize', etc.)
 * @returns {Object} Ranking information
 */
export async function getUserRanking(userId, statField = 'uploadCount') {
  try {
    const userStats = await getUserStats(userId);
    if (!userStats) {
      return { rank: null, total: 0, value: 0 };
    }
    
    const userValue = userStats[statField] || 0;
    
    // Count users with higher values (more efficient than sorting all)
    const higherUsersSnapshot = await userStatsCollection
      .where(statField, '>', userValue)
      .get();
    
    const rank = higherUsersSnapshot.size + 1;
    
    // Get total user count from cached server stats
    const serverStats = await getServerStats();
    const totalUsers = serverStats.totalUsers || 0;
    
    return {
      rank,
      total: totalUsers,
      value: userValue,
      percentile: totalUsers > 0 ? Math.round((1 - (rank - 1) / totalUsers) * 100) : 0
    };
  } catch (error) {
    console.error('Error calculating user ranking:', error);
    throw error;
  }
}

/**
 * Calculate upload frequency (images per day)
 * @param {Object} userStats - User statistics object
 * @returns {number} Images per day
 */
export function calculateUploadFrequency(userStats) {
  if (!userStats.firstUpload || !userStats.lastUpload || userStats.uploadCount < 2) {
    return 0;
  }
  
  const daysSinceFirst = (userStats.lastUpload - userStats.firstUpload) / (1000 * 60 * 60 * 24);
  return daysSinceFirst > 0 ? (userStats.uploadCount / daysSinceFirst) : 0;
}

/**
 * Get top users for leaderboard
 * @param {string} statField - Field to rank by
 * @param {number} limit - Number of top users to return
 * @returns {Array} Top users array
 */
export async function getTopUsers(statField = 'uploadCount', limit = 10) {
  try {
    const snapshot = await userStatsCollection
      .orderBy(statField, 'desc')
      .limit(limit)
      .get();
    
    return snapshot.docs.map(doc => ({
      userId: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting top users:', error);
    throw error;
  }
}

/**
 * Update server-wide statistics (run periodically or on upload)
 */
async function updateServerStatsAsync() {
  // Run this in background to avoid blocking user uploads
  setTimeout(async () => {
    try {
      await calculateAndCacheServerStats();
    } catch (error) {
      console.error('Background server stats update failed:', error);
    }
  }, 1000); // 1 second delay
}

/**
 * Calculate and cache server statistics
 * @returns {Object} Server statistics
 */
async function calculateAndCacheServerStats() {
  try {
    console.log('Calculating server stats...');
    
    // Get all user stats efficiently
    const userStatsSnapshot = await userStatsCollection.get();
    
    let totalUsers = 0;
    let totalImages = 0;
    let allUploadCounts = [];
    let contentTypeStats = {};
    
    userStatsSnapshot.forEach(doc => {
      const stats = doc.data();
      totalUsers++;
      totalImages += stats.uploadCount || 0;
      allUploadCounts.push(stats.uploadCount || 0);
      
      // Aggregate content types
      if (stats.contentTypes) {
        Object.entries(stats.contentTypes).forEach(([type, count]) => {
          contentTypeStats[type] = (contentTypeStats[type] || 0) + count;
        });
      }
    });
    
    // Calculate median uploads
    allUploadCounts.sort((a, b) => a - b);
    
    const medianUploads = allUploadCounts.length > 0 ? 
      allUploadCounts[Math.floor(allUploadCounts.length / 2)] : 0;
    
    const serverStats = {
      totalUsers,
      totalImages,
      avgImagesPerUser: totalUsers > 0 ? Math.round(totalImages / totalUsers) : 0,
      medianUploads,
      contentTypeStats,
      lastUpdated: Date.now()
    };
    
    // Cache the results
    await serverStatsCollection.doc('global').set(serverStats);
    console.log('Server stats updated successfully');
    
    return serverStats;
  } catch (error) {
    console.error('Error calculating server stats:', error);
    throw error;
  }
}

/**
 * Update user stats when an image is deleted
 * @param {Object} imageData - The image data being deleted
 */
export async function updateUserStatsOnDelete(imageData) {
  const userId = imageData.author.id;
  const userStatsRef = userStatsCollection.doc(userId);
  
  try {
    await firestore.runTransaction(async (transaction) => {
      const userStatsDoc = await transaction.get(userStatsRef);
      
      if (!userStatsDoc.exists) {
        // User stats don't exist, nothing to update
        console.log('No user stats found for deletion update');
        return;
      }
      
      const currentStats = userStatsDoc.data();
      const newUploadCount = Math.max(0, currentStats.uploadCount - 1);
      const newTotalSize = Math.max(0, currentStats.totalSize - imageData.size);
      
      const updatedStats = {
        uploadCount: newUploadCount,
        totalSize: newTotalSize,
        avgSize: newUploadCount > 0 ? Math.round(newTotalSize / newUploadCount) : 0,
        contentTypes: {
          ...currentStats.contentTypes,
          [getContentTypeLabel(imageData)]: Math.max(0, (currentStats.contentTypes[getContentTypeLabel(imageData)] || 1) - 1)
        },
        lastUpdated: Date.now()
      };
      
      // Remove content type if count reaches 0
      const contentTypeLabel = getContentTypeLabel(imageData);
      if (updatedStats.contentTypes[contentTypeLabel] === 0) {
        delete updatedStats.contentTypes[contentTypeLabel];
      }
      
      transaction.update(userStatsRef, updatedStats);
    });
    
    // Schedule server stats update (non-blocking)
    updateServerStatsAsync();
  } catch (error) {
    console.error('Error updating user stats on deletion:', error);
    throw error;
  }
}

/**
 * Get proper content type label for an image
 * @param {Object} imageData - The image data
 * @returns {string} Content type label
 */
function getContentTypeLabel(imageData) {
  // If content type exists and is not empty, use it
  if (imageData.contentType && imageData.contentType.trim() !== '') {
    return imageData.contentType;
  }
  
  // Check if it's a Tenor GIF based on URL or filename
  if (imageData.url && imageData.url.includes('tenor')) {
    return 'Tenor Gif';
  }
  
  if (imageData.filename && imageData.filename.includes('tenor')) {
    return 'Tenor Gif';
  }
  
  // Fallback to unknown
  return 'unknown';
}

/**
 * Force refresh server statistics (for admin use)
 */
export async function refreshServerStats() {
  return await calculateAndCacheServerStats();
} 