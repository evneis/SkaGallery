import { getImageById } from './imageHandler.js';
import { AttachmentBuilder } from 'discord.js';
import fs from 'fs';

/**
 * Posts an image to a Discord interaction/channel using its ID
 * @param {Object} interaction - Discord.js Interaction object
 * @param {number} imageId - ID of the image to post
 * @param {Object} options - Additional options for posting
 * @returns {Promise<void>}
 */
export async function postImageById(interaction, imageId, options = {}) {
  try {
    const image = await getImageById(imageId);
    
    if (!image) {
      throw new Error(`No image found with ID: ${imageId}`);
    }

    // Default options
    const defaultOptions = {
      includeMetadata: false,
      ephemeral: false
    };

    const finalOptions = { ...defaultOptions, ...options };
    
    // If it's a Tenor URL, send it as plain text for proper embedding
    if (image.url.includes('tenor')) {
      return interaction.editReply(image.url);
    }

    // Check if the URL is a local file path (doesn't contain "tenor")
    let attachment;
    if (!image.url.includes('tenor') && fs.existsSync(image.url)) {
      // It's a local file path, read from local storage
      attachment = new AttachmentBuilder(image.url)
        .setDescription(`${image.id}`);
    } else {
      // It's a URL (fallback case), use URL
      attachment = new AttachmentBuilder(image.url)
        .setDescription(`${image.id}`);
    }

    const messagePayload = {
      files: [attachment],
      ephemeral: finalOptions.ephemeral
    };

    // Optionally include metadata
    if (finalOptions.includeMetadata) {
      messagePayload.embeds = [{
        title: `Image #${image.id}`,
        fields: [
          {
            name: 'Posted by',
            value: image.author?.displayName || 'Unknown',
            inline: true
          },
          {
            name: 'Original filename',
            value: image.filename || 'Unknown',
            inline: true
          }
        ],
        timestamp: image.timestamp
      }];
    }

    // Handle both deferred and non-deferred interactions
    if (interaction.deferred) {
      await interaction.editReply(messagePayload);
    } else {
      await interaction.reply(messagePayload);
    }
  } catch (error) {
    console.error('Error posting image:', error);
    const errorMessage = 'Failed to post the image!';
    
    if (interaction.deferred) {
      await interaction.editReply(errorMessage);
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
} 