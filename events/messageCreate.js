import { Events } from 'discord.js';
import path from 'path';
import config from '../config.js';
import { downloadImage } from '../utils/imageHandler.js';

export const name = Events.MessageCreate;
export const once = false;

export async function execute(message) {
  // Ignore bot messages
  if (message.author.bot) return;
  
  // Only process messages in the gallery channel
  if (message.channelId !== config.galleryChannelId) return;
  
  // Process attachments for images
  if (message.attachments.size > 0) {
    for (const [, attachment] of message.attachments) {
      // Check if the attachment is an image
      const fileExtension = path.extname(attachment.name).toLowerCase();
      const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      
      if (validExtensions.includes(fileExtension)) {
        try {
          // Generate a unique filename with timestamp
          const timestamp = Date.now();
          const filename = `${timestamp}-${attachment.name}`;
          
          // Download and save the image
          await downloadImage(attachment.url, filename);
          
          // React to confirm the image was saved
          await message.react('✅');
          
          console.log(`Image saved: ${filename}`);
        } catch (error) {
          console.error('Error saving image:', error);
          await message.react('❌');
        }
      }
    }
  }
  
  // Check if the message has embedded images (URLs)
  const urlRegex = /(http(s?):)([/|.|\w|\s|-])*\.(?:jpg|jpeg|gif|png|webp)(\?(?:[a-z0-9_]+==[^&]*))?/gi;
  const imageUrls = message.content.match(urlRegex);
  
  if (imageUrls) {
    for (const url of imageUrls) {
      try {
        // Generate a unique filename with timestamp
        const timestamp = Date.now();
        const urlPath = new URL(url).pathname;
        const filename = `${timestamp}-${path.basename(urlPath)}`;
        
        // Download and save the image
        await downloadImage(url, filename);
        
        // React to confirm the image was saved
        await message.react('✅');
        
        console.log(`Image saved from URL: ${filename}`);
      } catch (error) {
        console.error('Error saving image from URL:', error);
        await message.react('❌');
      }
    }
  }
} 