import { Events } from 'discord.js';
import path from 'path';
import config from '../config.js';
import { saveImageUrl } from '../utils/imageHandler.js';
import fetch from 'node-fetch';

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
          // Store Discord CDN URL with metadata
          const metadata = {
            filename: attachment.name,
            size: attachment.size,
            width: attachment.width,
            height: attachment.height,
            author: {
              id: message.author.id,
              username: message.author.username,
              displayName: message.author.displayName
            },
            messageId: message.id,
            messageLink: message.url,
            contentType: attachment.contentType
          };
          
          // Save the URL
          await saveImageUrl(attachment.url, metadata);
          
          // React to confirm the image was saved
          await message.react('✅');
          
          console.log(`Image URL saved: ${attachment.name}`);
        } catch (error) {
          console.error('Error saving image URL:', error);
          await message.react('❌');
        }
      }
    }
  }
  
  // Check if the message has embedded images (URLs)
  const urlRegex = /(http(s?):)([/|.|\w|\s|-])*\.(?:jpg|jpeg|gif|png|webp)(\?(?:[a-z0-9_]+==[^&]*)?)|https?:\/\/tenor\.com\/view\/[a-zA-Z0-9-]+/gi;
  const imageUrls = message.content.match(urlRegex);
  
  if (imageUrls) {
    for (const url of imageUrls) {
      try {
        // Check if the URL is a Discord CDN URL or Tenor URL
        const isDiscordCdn = url.includes('cdn.discordapp.com') || 
                            url.includes('media.discordapp.net');
        const isTenor = url.includes('tenor.com/view/');
        
        let processedUrl = url;
        let filename = '';
        
        if (isTenor) {
          // Keep the original Tenor URL for proper Discord embedding
          const tenorId = url.split('/').pop();
          filename = `tenor-${tenorId}`;
        } else {
          const urlPath = new URL(url).pathname;
          filename = path.basename(urlPath);
        }
        
        const metadata = {
          filename,
          author: {
            id: message.author.id,
            username: message.author.username,
            displayName: message.author.displayName
          },
          messageId: message.id,
          messageLink: message.url,
          source: isTenor ? 'tenor' : 'url',
          isDiscordCdn,
          isTenor
        };
        
        // Save the URL
        await saveImageUrl(processedUrl, metadata);
        
        // React to confirm the URL was saved
        await message.react('✅');
        
        console.log(`Image URL saved from text: ${filename}`);
      } catch (error) {
        console.error('Error saving image URL from text:', error);
        await message.react('❌');
      }
    }
  }
} 