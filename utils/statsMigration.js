import { firestore, imagesCollection } from './firebaseConfig.js';
import { userStatsCollection, serverStatsCollection } from './statsManager.js';

/**
 * Migrate existing images to populate user statistics
 * This should be run ONCE to backfill stats from existing data
 */
export async function migrateExistingData() {
  console.log('🔄 Starting migration of existing images to user stats...');
  
  try {
    // Get all existing images
    console.log('📊 Fetching all existing images...');
    const imagesSnapshot = await imagesCollection.get();
    
    if (imagesSnapshot.empty) {
      console.log('ℹ️  No existing images found in database.');
      return;
    }
    
    console.log(`📸 Found ${imagesSnapshot.size} existing images`);
    
    // Group images by user
    const userImageData = new Map();
    let processedCount = 0;
    
    imagesSnapshot.forEach(doc => {
      const imageData = doc.data();
      processedCount++;
      
      // Skip images without author info
      if (!imageData.author || !imageData.author.id) {
        console.log(`⚠️  Skipping image without author info: ${imageData.filename || 'unknown'}`);
        return;
      }
      
      const userId = imageData.author.id;
      
      if (!userImageData.has(userId)) {
        userImageData.set(userId, {
          userId,
          username: imageData.author.username,
          displayName: imageData.author.displayName,
          images: []
        });
      }
      
             userImageData.get(userId).images.push({
         size: imageData.size || 0,
         contentType: imageData.contentType,
         timestamp: imageData.timestamp || Date.now(),
         filename: imageData.filename,
         url: imageData.url
       });
      
      if (processedCount % 100 === 0) {
        console.log(`📊 Processed ${processedCount}/${imagesSnapshot.size} images...`);
      }
    });
    
    console.log(`👥 Found images from ${userImageData.size} unique users`);
    
    // Create user stats for each user
    let userCount = 0;
    const batchWrites = [];
    
    for (const [userId, userData] of userImageData) {
      userCount++;
      
      // Calculate user statistics
      const images = userData.images;
      const uploadCount = images.length;
      const totalSize = images.reduce((sum, img) => sum + (img.size || 0), 0);
      const avgSize = uploadCount > 0 ? Math.round(totalSize / uploadCount) : 0;
      
             // Group by content type
       const contentTypes = {};
       images.forEach(img => {
         const type = getContentTypeLabel(img);
         contentTypes[type] = (contentTypes[type] || 0) + 1;
       });
      
      // Find first and last upload timestamps
      const timestamps = images.map(img => img.timestamp).filter(t => t);
      const firstUpload = timestamps.length > 0 ? Math.min(...timestamps) : Date.now();
      const lastUpload = timestamps.length > 0 ? Math.max(...timestamps) : Date.now();
      
      const userStats = {
        userId,
        username: userData.username,
        displayName: userData.displayName,
        uploadCount,
        totalSize,
        avgSize,
        firstUpload,
        lastUpload,
        contentTypes,
        lastUpdated: Date.now(),
        migratedFromExisting: true // Flag to indicate this was migrated
      };
      
      // Prepare batch write
      batchWrites.push({
        ref: userStatsCollection.doc(userId),
        data: userStats
      });
      
      console.log(`📊 User ${userData.displayName || userData.username}: ${uploadCount} uploads`);
      
      // Execute batch writes in groups of 500 (Firestore limit)
      if (batchWrites.length >= 500) {
        await executeBatchWrites(batchWrites);
        batchWrites.length = 0;
      }
    }
    
    // Execute remaining batch writes
    if (batchWrites.length > 0) {
      await executeBatchWrites(batchWrites);
    }
    
    console.log(`✅ Successfully migrated ${userCount} users`);
    
    // Calculate and cache server stats
    console.log('🔄 Calculating server-wide statistics...');
    await calculateAndCacheServerStatsFromUserStats();
    
    console.log('🎉 Migration completed successfully!');
    
    // Print summary
    const serverStats = await serverStatsCollection.doc('global').get();
    if (serverStats.exists) {
      const data = serverStats.data();
      console.log('\n📈 Migration Summary:');
      console.log(`👥 Total Users: ${data.totalUsers}`);
      console.log(`📸 Total Images: ${data.totalImages}`);
      console.log(`📊 Average per User: ${data.avgImagesPerUser} images`);
    }
    
  } catch (error) {
    console.error('❌ Error during migration:', error);
    throw error;
  }
}

/**
 * Execute batch writes efficiently
 */
async function executeBatchWrites(batchWrites) {
  console.log(`💾 Writing batch of ${batchWrites.length} user stats...`);
  
  const batch = firestore.batch();
  batchWrites.forEach(({ ref, data }) => {
    batch.set(ref, data);
  });
  
  await batch.commit();
  console.log(`✅ Batch write completed`);
}

/**
 * Calculate server stats from user stats (optimized for migration)
 */
async function calculateAndCacheServerStatsFromUserStats() {
  try {
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
      lastUpdated: Date.now(),
      migratedFromExisting: true
    };
    
    await serverStatsCollection.doc('global').set(serverStats);
    console.log('✅ Server stats calculated and cached');
    
    return serverStats;
  } catch (error) {
    console.error('❌ Error calculating server stats:', error);
    throw error;
  }
}

/**
 * Check if migration has already been run
 */
export async function checkMigrationStatus() {
  try {
    // Check if any user stats exist with migration flag
    const userStatsSnapshot = await userStatsCollection.where('migratedFromExisting', '==', true).limit(1).get();
    const serverStatsDoc = await serverStatsCollection.doc('global').get();
    
    const hasMigratedUsers = !userStatsSnapshot.empty;
    const hasMigratedServer = serverStatsDoc.exists && serverStatsDoc.data().migratedFromExisting;
    
    return {
      hasRun: hasMigratedUsers && hasMigratedServer,
      userStatsCount: userStatsSnapshot.size,
      serverStatsExists: serverStatsDoc.exists
    };
  } catch (error) {
    console.error('Error checking migration status:', error);
    return { hasRun: false, userStatsCount: 0, serverStatsExists: false };
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
 * Safe migration runner that checks status first
 */
export async function runMigrationSafely() {
  console.log('🔍 Checking migration status...');
  
  const status = await checkMigrationStatus();
  
  if (status.hasRun) {
    console.log('ℹ️  Migration has already been completed.');
    console.log(`📊 Found existing migrated data: ${status.userStatsCount}+ users`);
    return;
  }
  
  console.log('🚀 Starting fresh migration...');
  await migrateExistingData();
} 