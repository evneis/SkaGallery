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
      { name: '📸 What Is This?', value: 'Any image posted will be saved in the gallery' },
      { name: '⚡ Reaction Images', value: 'React to any image with the ⚡ (zap) emoji to designate it as a reaction image. These can be accessed using the `/react` command.' },
      { name: '\u200B', value: '\u200B' }, // Empty field as divider
      { name: '🔍 Available Commands', value: 
        '• `/random` - View a random image from the gallery\n' +
        '• `/react` - Get a random reaction image\n' +
        '• `/help` - Display this help message'
      },
      { name: '🔍 Reply Commands', value: 
        '• `/delete` - delete the image you are replying to\n'
      }
    )
    .setFooter({ text: 'SkaGallery | github.com/evneis/SkaGallery', iconURL: interaction.client.user.displayAvatarURL() })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
} 