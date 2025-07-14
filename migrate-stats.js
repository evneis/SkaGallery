import { runMigrationSafely, checkMigrationStatus } from './utils/statsMigration.js';
import { config } from 'dotenv';

// Load environment variables
config();

console.log('🔄 SkaGallery Stats Migration Tool');
console.log('===================================');

async function main() {
  try {
    // Check current status first
    const status = await checkMigrationStatus();
    
    console.log('📊 Current Status:');
    console.log(`- Migration completed: ${status.hasRun ? '✅ Yes' : '❌ No'}`);
    console.log(`- User stats exist: ${status.userStatsCount > 0 ? '✅ Yes' : '❌ No'}`);
    console.log(`- Server stats exist: ${status.serverStatsExists ? '✅ Yes' : '❌ No'}\n`);
    
    if (status.hasRun) {
      console.log('ℹ️  Migration has already been completed. No action needed.');
      console.log('📊 Your stats should be available via the /stats command.');
      return;
    }
    
    console.log('🚀 Starting migration process...\n');
    await runMigrationSafely();
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('📊 Your users can now use the /stats command to see their statistics.');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

main(); 