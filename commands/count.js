import { SlashCommandBuilder } from 'discord.js';
import { getImageCount } from '../utils/imageHandler.js';

export const data = new SlashCommandBuilder()
  .setName('count')
  .setDescription('Get the number of images in the gallery');

export async function execute(interaction) {
  await interaction.deferReply();
  
  try {
    const count = await getImageCount();
    
    await interaction.editReply(`There are currently ${count} images in the gallery.`);
  } catch (error) {
    console.error('Error counting images:', error);
    await interaction.editReply('Failed to count images in the gallery!');
  }
} 