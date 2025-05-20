import { config } from 'dotenv';
import fs from 'fs';

// Load environment variables
config();

// Bot configuration
export default {
  // Discord configuration
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,
  
  // Gallery configuration
  galleryChannelId: process.env.GALLERY_CHANNEL_ID,
  storageDir: process.env.STORAGE_DIR || './images',
  
  // Firebase configuration
  firebase: {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
  },
  
  // Create storage directory if it doesn't exist
  ensureStorageExists() {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }
}; 