import { SlashCommandBuilder } from 'discord.js';
import { getRandomImageId } from '../utils/imageHandler.js';
import { postImageById } from '../utils/imagePostHandler.js';

export const data = new SlashCommandBuilder()
  .setName('random')
  .setDescription('Get a random image from the gallery');

export async function execute(interaction) {
  await interaction.deferReply();
  
  try {
    const randomImageId = await getRandomImageId();
    
    if (!randomImageId) {
      return interaction.editReply('No images found in the gallery!');
    }
    
    await postImageById(interaction, randomImageId);
  } catch (error) {
    console.error('Error fetching random image:', error);
    await interaction.editReply('Failed to fetch a random image!');
  }
} 