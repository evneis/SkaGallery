import { firestore } from './firebaseConfig.js';
import { imagesCollection } from './firebaseConfig.js';

// Get collection prefix from environment
const collectionPrefix = process.env.FIREBASE_COLLECTION_PREFIX || '';

// Define stats collections
export const userStatsCollection = firestore.collection(`${collectionPrefix}userStats`);
export const serverStatsCollection = firestore.collection(`${collectionPrefix}serverStats`);
export const weeklyStatsCollection = firestore.collection(`${collectionPrefix}weeklyStats`);

/**
 * Get the current week's start timestamp (Monday at 00:00:00 UTC)
 * @returns {number} Start timestamp of current week
 */
export function getCurrentWeekStart() {
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday = 0, Monday = 1
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - daysToMonday);
  monday.setUTCHours(0, 0, 0, 0);
  return monday.getTime();
}

/**
 * Get the next week's start timestamp
 * @returns {number} Start timestamp of next week
 */
export function getNextWeekStart() {
  const currentWeekStart = getCurrentWeekStart();
  return currentWeekStart + (7 * 24 * 60 * 60 * 1000); // Add 7 days
}

/**
 * Get days remaining until next reset
 * @returns {number} Days remaining (can be decimal)
 */
export function getDaysUntilReset() {
  const now = Date.now();
  const nextReset = getNextWeekStart();
  const msRemaining = nextReset - now;
  return msRemaining / (1000 * 60 * 60 * 24);
}

/**
 * Get the week identifier (YYYY-WW format)
 * @param {number} timestamp - Optional timestamp, defaults to current time
 * @returns {string} Week identifier
 */
export function getWeekIdentifier(timestamp = Date.now()) {
  const date = new Date(timestamp);
  const year = date.getUTCFullYear();
  const weekStart = getCurrentWeekStart();
  const weekDate = new Date(weekStart);
  const weekNumber = Math.ceil((weekDate.getUTCDate() + weekDate.getUTCDay()) / 7);
  return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
}

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
    
    // Update weekly stats (non-blocking)
    updateWeeklyStatsAsync(imageData);
    
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
 * Get top users for weekly leaderboard
 * @param {number} limit - Number of top users to return
 * @returns {Array} Top users array with weekly stats
 */
export async function getWeeklyTopUsers(limit = 10) {
  try {
    const currentWeek = getWeekIdentifier();
    const weeklyStatsRef = weeklyStatsCollection.doc(currentWeek);
    const weeklyStatsDoc = await weeklyStatsRef.get();
    
    if (!weeklyStatsDoc.exists) {
      return [];
    }
    
    const weeklyStats = weeklyStatsDoc.data();
    const userStats = weeklyStats.userStats || {};
    
    // Convert to array and sort by upload count
    const topUsers = Object.entries(userStats)
      .map(([userId, stats]) => ({
        userId,
        ...stats
      }))
      .sort((a, b) => b.uploadCount - a.uploadCount)
      .slice(0, limit);
    
    return topUsers;
  } catch (error) {
    console.error('Error getting weekly top users:', error);
    throw error;
  }
}

/**
 * Get weekly stats for a specific user
 * @param {string} userId - Discord user ID
 * @returns {Object|null} Weekly stats for the user or null if not found
 */
export async function getUserWeeklyStats(userId) {
  try {
    const currentWeek = getWeekIdentifier();
    const weeklyStatsRef = weeklyStatsCollection.doc(currentWeek);
    const weeklyStatsDoc = await weeklyStatsRef.get();
    
    if (!weeklyStatsDoc.exists) {
      return null;
    }
    
    const weeklyStats = weeklyStatsDoc.data();
    const userStats = weeklyStats.userStats || {};
    
    return userStats[userId] || null;
  } catch (error) {
    console.error('Error getting user weekly stats:', error);
    throw error;
  }
}

/**
 * Get current week's summary statistics
 * @returns {Object|null} Weekly summary stats or null if no data
 */
export async function getWeeklySummary() {
  try {
    const currentWeek = getWeekIdentifier();
    const weeklyStatsRef = weeklyStatsCollection.doc(currentWeek);
    const weeklyStatsDoc = await weeklyStatsRef.get();
    
    if (!weeklyStatsDoc.exists) {
      return null;
    }
    
    return weeklyStatsDoc.data();
  } catch (error) {
    console.error('Error getting weekly summary:', error);
    throw error;
  }
}

/**
 * Update weekly statistics (run in background)
 * @param {Object} imageData - The image data being uploaded
 */
async function updateWeeklyStatsAsync(imageData) {
  // Run this in background to avoid blocking user uploads
  setTimeout(async () => {
    try {
      await updateWeeklyStats(imageData);
    } catch (error) {
      console.error('Background weekly stats update failed:', error);
    }
  }, 1000); // 1 second delay
}

/**
 * Update weekly statistics for a user
 * @param {Object} imageData - The image data being uploaded
 */
async function updateWeeklyStats(imageData) {
  const userId = imageData.author.id;
  const currentWeek = getWeekIdentifier();
  const weeklyStatsRef = weeklyStatsCollection.doc(currentWeek);
  
  try {
    await firestore.runTransaction(async (transaction) => {
      const weeklyStatsDoc = await transaction.get(weeklyStatsRef);
      
      if (!weeklyStatsDoc.exists) {
        // First upload of the week
        const newWeeklyStats = {
          weekId: currentWeek,
          weekStart: getCurrentWeekStart(),
          weekEnd: getNextWeekStart(),
          userStats: {
            [userId]: {
              userId: userId,
              username: imageData.author.username,
              displayName: imageData.author.displayName,
              uploadCount: 1,
              totalSize: imageData.size,
              lastUpdated: Date.now()
            }
          },
          totalUploads: 1,
          totalUsers: 1,
          lastUpdated: Date.now()
        };
        transaction.set(weeklyStatsRef, newWeeklyStats);
      } else {
        // Update existing weekly stats
        const currentWeeklyStats = weeklyStatsDoc.data();
        const userStats = currentWeeklyStats.userStats || {};
        
        if (!userStats[userId]) {
          // First upload for this user this week
          userStats[userId] = {
            userId: userId,
            username: imageData.author.username,
            displayName: imageData.author.displayName,
            uploadCount: 1,
            totalSize: imageData.size,
            lastUpdated: Date.now()
          };
          currentWeeklyStats.totalUsers = Object.keys(userStats).length;
        } else {
          // Update existing user stats for this week
          userStats[userId].uploadCount += 1;
          userStats[userId].totalSize += imageData.size;
          userStats[userId].lastUpdated = Date.now();
        }
        
        currentWeeklyStats.userStats = userStats;
        currentWeeklyStats.totalUploads += 1;
        currentWeeklyStats.lastUpdated = Date.now();
        
        transaction.update(weeklyStatsRef, currentWeeklyStats);
      }
    });
  } catch (error) {
    console.error('Error updating weekly stats:', error);
    throw error;
  }
}

/**
 * Update weekly statistics on deletion (run in background)
 * @param {Object} imageData - The image data being deleted
 */
async function updateWeeklyStatsOnDeleteAsync(imageData) {
  // Run this in background to avoid blocking user deletions
  setTimeout(async () => {
    try {
      await updateWeeklyStatsOnDelete(imageData);
    } catch (error) {
      console.error('Background weekly stats deletion update failed:', error);
    }
  }, 1000); // 1 second delay
}

/**
 * Update weekly statistics when an image is deleted
 * @param {Object} imageData - The image data being deleted
 */
async function updateWeeklyStatsOnDelete(imageData) {
  const userId = imageData.author.id;
  const currentWeek = getWeekIdentifier();
  const weeklyStatsRef = weeklyStatsCollection.doc(currentWeek);
  
  try {
    await firestore.runTransaction(async (transaction) => {
      const weeklyStatsDoc = await transaction.get(weeklyStatsRef);
      
      if (!weeklyStatsDoc.exists) {
        // No weekly stats for this week, nothing to update
        return;
      }
      
      const currentWeeklyStats = weeklyStatsDoc.data();
      const userStats = currentWeeklyStats.userStats || {};
      
      if (!userStats[userId]) {
        // User has no stats for this week, nothing to update
        return;
      }
      
      // Update user stats for this week
      userStats[userId].uploadCount = Math.max(0, userStats[userId].uploadCount - 1);
      userStats[userId].totalSize = Math.max(0, userStats[userId].totalSize - imageData.size);
      userStats[userId].lastUpdated = Date.now();
      
      // Remove user if they have no uploads left this week
      if (userStats[userId].uploadCount === 0) {
        delete userStats[userId];
        currentWeeklyStats.totalUsers = Object.keys(userStats).length;
      }
      
      currentWeeklyStats.userStats = userStats;
      currentWeeklyStats.totalUploads = Math.max(0, currentWeeklyStats.totalUploads - 1);
      currentWeeklyStats.lastUpdated = Date.now();
      
      transaction.update(weeklyStatsRef, currentWeeklyStats);
    });
  } catch (error) {
    console.error('Error updating weekly stats on deletion:', error);
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
    
    // Update weekly stats on deletion (non-blocking)
    updateWeeklyStatsOnDeleteAsync(imageData);
    
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