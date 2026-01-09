import { SlashCommandBuilder } from 'discord.js';
import { getRandomImageId } from '../utils/imageHandler.js';
import { postImageById } from '../utils/imagePostHandler.js';

export const data = new SlashCommandBuilder()
  .setName('random')
  .setDescription('Get a random image from the gallery')
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
    const randomImageId = await getRandomImageId(type || null);
    
    if (!randomImageId) {
      const typeMessage = type === 'gif' ? 'GIFs' : type === 'img' ? 'images' : '';
      return interaction.editReply(`No ${typeMessage} found in the gallery!`);
    }
    
    await postImageById(interaction, randomImageId);
  } catch (error) {
    console.error('Error fetching random image:', error);
    await interaction.editReply('Failed to fetch a random image!');
  }
} 