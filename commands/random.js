import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { getRandomImage, getImageMetadata } from '../utils/imageHandler.js';
import fs from 'fs';

export const data = new SlashCommandBuilder()
  .setName('random')
  .setDescription('Get a random image from the gallery');

export async function execute(interaction) {
  await interaction.deferReply();
  
  try {
    const randomImagePath = getRandomImage();
    
    if (!randomImagePath) {
      return interaction.editReply('No images found in the gallery!');
    }
    
    const metadata = getImageMetadata(randomImagePath);
    const fileBuffer = fs.readFileSync(randomImagePath);
    const attachment = new AttachmentBuilder(fileBuffer, { name: metadata.filename });
    
    await interaction.editReply({
      content: `Random image: ${metadata.filename}`,
      files: [attachment]
    });
  } catch (error) {
    console.error('Error fetching random image:', error);
    await interaction.editReply('Failed to fetch a random image!');
  }
} 