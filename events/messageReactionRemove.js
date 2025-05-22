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

    // Look for image attachments in the message
    const attachment = message.attachments.first();
    if (!attachment) {
      console.log('No attachments found in the message');
      return;
    }

    // Extract filename using the same approach as in messageCreate.js
    const url = attachment.url;
    const isDiscordCdn = url.includes('cdn.discordapp.com') || 
                         url.includes('media.discordapp.net');
    const isTenor = url.includes('tenor.com/view/');
    
    let filename = '';
    
    if (isTenor) {
      // Keep the original Tenor URL for proper Discord embedding
      const tenorId = url.split('/').pop();
      filename = `tenor-${tenorId}`;
    } else {
      const urlPath = new URL(url).pathname;
      filename = path.basename(urlPath);
    }

    try {
      // Find the image in Firebase using the filename instead of messageId
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