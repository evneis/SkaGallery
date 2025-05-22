import { Events } from 'discord.js';
import { firestore, imagesCollection } from '../utils/firebaseConfig.js';
import path from 'path';

export const name = Events.MessageReactionRemove;
export const once = false;

export async function execute(reaction, user) {
  // Ignore bot reactions
  if (user.bot) return;

  // Check if the reaction is the voltage emoji (⚡)
  if (reaction.emoji.name === '⚡' || reaction.emoji.name === 'zap') {
    // Partial reactions need to be fetched to access message properties
    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch (error) {
        console.error('Something went wrong when fetching the reaction:', error);
        return;
      }
    }

    const message = reaction.message;

    // Initialize variables
    let filename = null;
    
    // Check for attachments first
    if (message.attachments.size > 0) {
      const attachment = message.attachments.first();
      const url = attachment.url;
      
      const isDiscordCdn = url.includes('cdn.discordapp.com') || 
                          url.includes('media.discordapp.net');
      const isTenor = url.includes('tenor.com/view/');
      
      if (isTenor) {
        const tenorId = url.split('/').pop();
        filename = `tenor-${tenorId}`;
      } else {
        const urlPath = new URL(url).pathname;
        filename = path.basename(urlPath);
      }
    } 
    // If no attachments, check for embedded URLs
    else if (message.content) {
      const urlRegex = /(http(s?):)([/|.|\w|\s|-])*\.(?:jpg|jpeg|gif|png|webp)(\?(?:[a-z0-9_]+==[^&]*)?)|https?:\/\/tenor\.com\/view\/[a-zA-Z0-9-]+/gi;
      const imageUrls = message.content.match(urlRegex);
      
      if (imageUrls && imageUrls.length > 0) {
        const url = imageUrls[0]; // Use the first URL found
        
        const isDiscordCdn = url.includes('cdn.discordapp.com') || 
                            url.includes('media.discordapp.net');
        const isTenor = url.includes('tenor.com/view/');
        
        if (isTenor) {
          const tenorId = url.split('/').pop();
          filename = `tenor-${tenorId}`;
        } else {
          const urlPath = new URL(url).pathname;
          filename = path.basename(urlPath);
        }
      }
    }
    // Check for embeds (for tenor GIFs or other embed types)
    else if (message.embeds.length > 0) {
      const embed = message.embeds[0];
      
      // Check if it's a tenor URL
      if (embed.url && embed.url.includes('tenor.com/view/')) {
        const tenorId = embed.url.split('/').pop();
        filename = `tenor-${tenorId}`;
      }
      // Check for image embeds
      else if (embed.image) {
        const urlPath = new URL(embed.image.url).pathname;
        filename = path.basename(urlPath);
      }
    }
    
    // If no filename was found, we can't proceed
    if (!filename) {
      console.log('No image or GIF found in the message');
      return;
    }

    try {
      // Find the image in Firebase using the filename
      const snapshot = await imagesCollection.where('filename', '==', filename).get();

      if (snapshot.empty) {
        console.log(`No image found with filename: ${filename}`);
        return;
      }

      // Get the document
      const doc = snapshot.docs[0];
      const imageData = doc.data();
      
      // Check if there are any remaining zap reactions on this message
      const remainingZapReactions = message.reactions.cache.filter(
        r => r.emoji.name === '⚡' || r.emoji.name === 'zap'
      );
      
      // Only remove the tag if there are no more zap reactions
      if (remainingZapReactions.size === 0 && imageData.imageTags.includes('react')) {
        const updatedTags = imageData.imageTags.filter(tag => tag !== 'react');
        
        // Update the document in Firebase
        await doc.ref.update({ imageTags: updatedTags });
        console.log(`Removed 'react' tag from image with filename: ${filename}`);
      }
    } catch (error) {
      console.error('Error updating image tags:', error);
    }
  }
} 