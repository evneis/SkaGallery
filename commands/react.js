import { SlashCommandBuilder } from 'discord.js';
import { firestore, imagesCollection } from '../utils/firebaseConfig.js';
import { postImageById } from '../utils/imagePostHandler.js';

export const data = new SlashCommandBuilder()
  .setName('react')
  .setDescription('Get a random reaction image');

export async function execute(interaction) {
  await interaction.deferReply();
  
  try {
    // Query images with the 'react' tag
    const snapshot = await imagesCollection.where('imageTags', 'array-contains', 'react').get();
    
    if (snapshot.empty) {
      return interaction.editReply('No images with reactions found in the gallery!');
    }
    
    // Get all document IDs
    const imageIds = snapshot.docs.map(doc => doc.id);
    
    // Select a random image ID
    const randomIndex = Math.floor(Math.random() * imageIds.length);
    const randomImageId = imageIds[randomIndex];
    
    await postImageById(interaction, randomImageId);
  } catch (error) {
    console.error('Error fetching random reacted image:', error);
    await interaction.editReply('Failed to fetch a random image with reactions!');
  }
} 