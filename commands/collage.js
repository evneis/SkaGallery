import { SlashCommandBuilder } from 'discord.js';
import { imagesCollection } from '../utils/firebaseConfig.js';
import { createCollage } from '../utils/collageHandler.js';

export const data = new SlashCommandBuilder()
  .setName('collage')
  .setDescription('Create a 3x3 collage of images from a specific user')
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('The user whose images to include in the collage')
      .setRequired(false)
  );

export async function execute(interaction) {
  await interaction.deferReply();
  
  try {
    // Get the target user (from option or command user)
    const targetUser = interaction.options.getUser('user') || interaction.user;
    
    console.log(`Creating collage for user: ${targetUser.username} (ID: ${targetUser.id})`);
    
    // Query images by user ID (preferred) and filter out GIFs
    const snapshot = await imagesCollection
      .where('author.id', '==', targetUser.id)
      .get();
    
    if (snapshot.empty) {
      return interaction.editReply(`No images found for user ${targetUser.username}!`);
    }
    
    // Filter out GIFs and Tenor URLs to get only static images
    const validImages = [];
    snapshot.docs.forEach(doc => {
      const imageData = doc.data();
      
      // Skip if it's a Tenor URL (GIF)
      if (imageData.url && imageData.url.includes('tenor')) {
        return;
      }
      
      // Skip if filename indicates it's a GIF
      if (imageData.filename && imageData.filename.toLowerCase().endsWith('.gif')) {
        return;
      }
      
      // Skip if contentType indicates it's a GIF
      if (imageData.contentType && imageData.contentType.includes('gif')) {
        return;
      }
      
      validImages.push({
        id: doc.id,
        ...imageData
      });
    });
    
    if (validImages.length === 0) {
      return interaction.editReply(`No static images found for user ${targetUser.username}! (GIFs are excluded from collages)`);
    }
    
    // Shuffle and take up to 9 images for the 3x3 collage
    const shuffledImages = validImages.sort(() => Math.random() - 0.5);
    const selectedImages = shuffledImages.slice(0, 9);
    
    console.log(`Selected ${selectedImages.length} images for collage`);
    
    // Create the collage
    const collageBuffer = await createCollage(selectedImages);
    
    // Send the collage
    await interaction.editReply({
      content: `3x3 collage of ${selectedImages.length} image${selectedImages.length !== 1 ? 's' : ''} by ${targetUser.username}`,
      files: [{
        attachment: collageBuffer,
        name: `collage-${targetUser.username}-${Date.now()}.png`
      }]
    });
    
  } catch (error) {
    console.error('Error creating collage:', error);
    await interaction.editReply('Failed to create collage! Please try again later.');
  }
} 