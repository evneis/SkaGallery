import { Events } from 'discord.js';
import path from 'path';
import config from '../config.js';
import { saveImageUrl, deleteImageByFilename } from '../utils/imageHandler.js';
import fetch from 'node-fetch';

export const name = Events.MessageCreate;
export const once = false;

export async function execute(message) {
  try {
    // Ignore bot messages
    if (message.author.bot) return;
    
    // Check if message is a reply with "/delete" command
    if (message.reference && message.content.trim().toLowerCase() === '/delete') {
      try {
        // Fetch the message being replied to
        const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
        
        // Verify the replied message is from the bot
        if (!repliedMessage.author.bot) {
          // await message.reply("You can only delete images posted by the bot.");
          return;
        }
        
        // Try to find the image filename in the message
        let filenameToDelete = null;
        
        // Check for attachments
        if (repliedMessage.attachments.size > 0) {
          const attachment = repliedMessage.attachments.first();
          filenameToDelete = attachment.name;
        } 
        // Check for embeds (for tenor GIFs or other embed types)
        else if (repliedMessage.embeds.length > 0) {
          const embed = repliedMessage.embeds[0];
          
          // Check if it's a tenor URL
          if (embed.url && embed.url.includes('tenor.com/view/')) {
            const tenorId = embed.url.split('/').pop();
            filenameToDelete = `tenor-${tenorId}`;
          }
          // Check for image embeds
          else if (embed.image) {
            const urlPath = new URL(embed.image.url).pathname;
            filenameToDelete = path.basename(urlPath);
          }
        }
        
        if (!filenameToDelete) {
          await message.reply("Could not find an image to delete in that message.");
          return;
        }
        
        // Delete the image from Firebase
        const isDeleted = await deleteImageByFilename(filenameToDelete);
        
        if (isDeleted) {
          await message.reply(`Successfully deleted image: ${filenameToDelete}`);
          // Optionally delete the original message
          // await repliedMessage.delete();
        } else {
          await message.reply(`Could not find image "${filenameToDelete}" in the database.`);
        }
      } catch (error) {
        console.error('Error handling delete command:', error);
        await message.reply('An error occurred while trying to delete the image.');
      }
      return;
    }
    
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
            //await message.react('✅');
            
            console.log(`Image URL saved: ${attachment.name}`);
          } catch (error) {
            console.error('Error saving image URL:', error);
            try {
              // Check if it's a duplicate image error
              if (error.message && error.message.includes('already exists')) {
                //await message.react('🔄'); // Use a different reaction for duplicates
                console.log(`Duplicate image detected: ${attachment.name}`);
              } else {
                await message.react('❌');
              }
            } catch (reactionError) {
              console.error('Error adding reaction:', reactionError);
            }
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
            source: isTenor ? 'tenor' : (isDiscordCdn ? 'discord' : 'url'),
          };
          
          // Save the URL
          await saveImageUrl(processedUrl, metadata);
          
          // React to confirm the URL was saved
          //await message.react('✅');
          
          console.log(`Image URL saved from text: ${filename}`);
        } catch (error) {
          console.error('Error saving image URL from text:', error);
          try {
            // Check if it's a duplicate image error
            if (error.message && error.message.includes('already exists')) {
              //await message.react('🔄'); // Use a different reaction for duplicates
              console.log(`Duplicate image detected: ${filename}`);
            } else {
              await message.react('❌');
            }
          } catch (reactionError) {
            console.error('Error adding reaction:', reactionError);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error in messageCreate event handler:', error);
  }
} 