import { SlashCommandBuilder } from 'discord.js';
import { getAllImages } from '../utils/imageHandler.js';

export const data = new SlashCommandBuilder()
  .setName('count')
  .setDescription('Get the number of images in the gallery');

export async function execute(interaction) {
  try {
    const images = getAllImages();
    const count = images.length;
    
    await interaction.reply(`There are currently ${count} images in the gallery.`);
  } catch (error) {
    console.error('Error counting images:', error);
    await interaction.reply('Failed to count images in the gallery!');
  }
} 