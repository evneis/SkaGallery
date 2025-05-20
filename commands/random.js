import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
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
    
    // Create a rich embed with the image and metadata
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle(`Random Image #${randomImage.id}`)
      .setImage(randomImage.url)
      .setTimestamp(new Date(randomImage.timestamp));
    
    // Add metadata fields if available
    if (randomImage.filename) {
      embed.setDescription(`Filename: ${randomImage.filename}`);
    }
    
    if (randomImage.author) {
      embed.setFooter({ 
        text: `Posted by ${randomImage.author.displayName || randomImage.author.username}`,
        iconURL: interaction.client.users.cache.get(randomImage.author.id)?.displayAvatarURL() 
      });
    }
    
    if (randomImage.width && randomImage.height) {
      embed.addFields({ name: 'Dimensions', value: `${randomImage.width}x${randomImage.height}`, inline: true });
    }
    
    if (randomImage.messageLink) {
      embed.addFields({ name: 'Original Message', value: `[Link](${randomImage.messageLink})`, inline: true });
    }
    
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error fetching random image:', error);
    await interaction.editReply('Failed to fetch a random image!');
  }
} 