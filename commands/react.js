import { SlashCommandBuilder } from 'discord.js';
import { firestore, imagesCollection } from '../utils/firebaseConfig.js';
import { postImageById } from '../utils/imagePostHandler.js';

export const data = new SlashCommandBuilder()
  .setName('react')
  .setDescription('Get a random reaction image')
  .addStringOption(option =>
    option
      .setName('type')
      .setDescription('Filter by image type')
      .setRequired(false)
      .addChoices(
        { name: 'Image', value: 'img' },
        { name: 'GIF', value: 'gif' }
      )
  );

export async function execute(interaction) {
  await interaction.deferReply();
  
  try {
    const type = interaction.options.getString('type');
    let imageIds = [];

    if (type === 'gif') {
      // For GIFs: Query by react tag AND source field (most efficient - uses indexed fields)
      const sourceQuery = await imagesCollection
        .where('imageTags', 'array-contains', 'react')
        .where('source', '==', 'tenor')
        .get();
      const sourceIds = sourceQuery.docs.map(doc => doc.id);
      
      // Fallback: Also check documents without source field by URL pattern
      // Since source field usually doesn't exist, we need this fallback
      const allReactSnapshot = await imagesCollection
        .where('imageTags', 'array-contains', 'react')
        .get();
      const missingSourceIds = allReactSnapshot.docs
        .filter(doc => {
          const data = doc.data();
          // Include if source doesn't exist AND URL contains "tenor"
          return !data.source && data.url && data.url.includes('tenor');
        })
        .map(doc => doc.id);
      
      // Combine both sets, avoiding duplicates
      imageIds = [...new Set([...sourceIds, ...missingSourceIds])];
    } else if (type === 'img') {
      // For images: Query by react tag AND source field (uses indexed fields)
      const sourceQuery = await imagesCollection
        .where('imageTags', 'array-contains', 'react')
        .where('source', 'in', ['discord', 'url'])
        .get();
      const sourceIds = sourceQuery.docs.map(doc => doc.id);
      
      // Fallback: Also check documents without source field (excluding tenor URLs)
      // Since source field usually doesn't exist, we need this fallback
      const allReactSnapshot = await imagesCollection
        .where('imageTags', 'array-contains', 'react')
        .get();
      const missingSourceIds = allReactSnapshot.docs
        .filter(doc => {
          const data = doc.data();
          // Include if source doesn't exist AND URL doesn't contain "tenor"
          return !data.source && (!data.url || !data.url.includes('tenor'));
        })
        .map(doc => doc.id);
      
      // Combine both sets, avoiding duplicates
      imageIds = [...new Set([...sourceIds, ...missingSourceIds])];
    } else {
      // No type filter: just query by react tag (original behavior)
      const snapshot = await imagesCollection
        .where('imageTags', 'array-contains', 'react')
        .get();
      imageIds = snapshot.docs.map(doc => doc.id);
    }
    
    if (imageIds.length === 0) {
      const typeMessage = type === 'gif' ? ' GIF' : type === 'img' ? ' image' : '';
      return interaction.editReply(`No${typeMessage} reactions found in the gallery!`);
    }
    
    // Select a random image ID
    const randomIndex = Math.floor(Math.random() * imageIds.length);
    const randomImageId = imageIds[randomIndex];
    
    await postImageById(interaction, randomImageId);
  } catch (error) {
    console.error('Error fetching random reacted image:', error);
    await interaction.editReply('Failed to fetch a random image with reactions!');
  }
} 