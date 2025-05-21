import { SlashCommandBuilder } from 'discord.js';
import { getRandomImage } from '../utils/imageHandler.js';

export const data = new SlashCommandBuilder()
  .setName('random')
  .setDescription('Get a random image from the gallery');

export async function execute(interaction) {
  await interaction.deferReply();
  
  try {
    const randomImage = await getRandomImage();
    
    if (!randomImage) {
      return interaction.editReply('No images found in the gallery!');
    }
    
    // Simply post the image with no other context
    await interaction.editReply({ 
      files: [randomImage.url]
    });
  } catch (error) {
    console.error('Error fetching random image:', error);
    await interaction.editReply('Failed to fetch a random image!');
  }
} 