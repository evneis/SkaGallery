import { Events } from 'discord.js';
import { firestore, imagesCollection } from '../utils/firebaseConfig.js';

export const name = Events.MessageReactionAdd;
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

    try {
      // Find the image in Firebase using the messageId
      const snapshot = await imagesCollection.where('messageId', '==', message.id).get();

      if (snapshot.empty) {
        console.log(`No image found with messageId: ${message.id}`);
        return;
      }

      // Get the document and update tags
      const doc = snapshot.docs[0];
      const imageData = doc.data();
      
      // Add 'react' tag if it doesn't already exist
      if (!imageData.imageTags.includes('react')) {
        const updatedTags = [...imageData.imageTags, 'react'];
        
        // Update the document in Firebase
        await doc.ref.update({ imageTags: updatedTags });
        console.log(`Added 'react' tag to image with messageId: ${message.id}`);
      }
    } catch (error) {
      console.error('Error updating image tags:', error);
    }
  }
} 