import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Shows information about the bot and available commands');

export async function execute(interaction) {
  const embed = new EmbedBuilder()
    .setColor(0x3498db) // Blue color
    .setTitle('SkaGallery Help')
    .setDescription('SkaGallery automatically saves images posted in your Discord server for later use.')
    .addFields(
      { name: '📸 What Is This?', value: 'This bot will save any image/gif posted in the server will be saved to the SkaGallery™ which can then be used with various commands.' },
      { name: '⚡ Reaction Images', value: 'React to any image with the ⚡ (zap) emoji to designate it as a reaction image. These can be accessed using the `/react` command.' },
      { name: '\u200B', value: '\u200B' }, // Empty field as divider
      { name: '🔍 Available Commands', value: 
        '• `/random` - View a random image from the gallery\n' +
        '• `/react` - Get a random reaction image\n' +
        '• `/collage @user` - Create a 3x3 collage of images from a user (excludes GIFs)\n' +
        '• `/help` - Display this help message'
      },
      { name: '🔍 Reply Commands', value: 
        '• `/delete` - delete the image you are replying to\n' +
        '• `/untag` - remove the tag from the image you are replying to'
      }
    )
    .setFooter({ text: 'SkaGallery | github.com/evneis/SkaGallery', iconURL: interaction.client.user.displayAvatarURL() })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
} 