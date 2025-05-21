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
    
    // If it's a Tenor URL, send it as plain text for proper embedding
    if (randomImage.isTenor) {
      return interaction.editReply(randomImage.url);
    }
    
    // For all other images, send as file
    await interaction.editReply({ 
      files: [randomImage.url]
    });
  } catch (error) {
    console.error('Error fetching random image:', error);
    await interaction.editReply('Failed to fetch a random image!');
  }
} 