import { Events } from 'discord.js';
import { imagesCollection } from '../utils/firebaseConfig.js';
import { saveImageUrl } from '../utils/imageHandler.js';
import path from 'path';

export const name = Events.ClientReady;
export const once = true;

export async function execute(client) {
  console.log(`Ready! Logged in as ${client.user.tag}`);
  console.log(`Serving ${client.guilds.cache.size} guild(s)`);
  
  // Scan for missed images after bot startup
  await scanMissedImages(client);
}

/**
 * Scans for images posted while the bot was offline
 * @param {Client} client - Discord.js client
 */
async function scanMissedImages(client) {
  try {
    console.log('Starting scan for missed images...');
    
    // Get the timestamp of the most recent image in Firestore
    const latestTimestamp = await getLatestImageTimestamp();
    
    if (!latestTimestamp) {
      console.log('No existing images found. Skipping scan.');
      return;
    }
    
    console.log(`Most recent image timestamp: ${new Date(latestTimestamp).toISOString()}`);
    
    // Get all guilds the bot is connected to
    for (const [guildId, guild] of client.guilds.cache) {
      // Get all text channels the bot has access to
      const textChannels = guild.channels.cache.filter(
        channel => channel.type === 0 && channel.viewable
      );
      
      console.log(`Scanning ${textChannels.size} channels in ${guild.name}`);
      
      // Process each channel
      for (const [channelId, channel] of textChannels) {
        await processChannelHistory(channel, latestTimestamp);
      }
    }
    
    console.log('Finished scanning for missed images');
  } catch (error) {
    console.error('Error scanning for missed images:', error);
  }
}

/**
 * Retrieves the timestamp of the most recent image
 * @returns {Promise<number|null>} The latest timestamp or null if no images exist
 */
async function getLatestImageTimestamp() {
  try {
    const snapshot = await imagesCollection.orderBy('timestamp', 'desc').limit(1).get();
    
    if (snapshot.empty) {
      return null;
    }
    
    return snapshot.docs[0].data().timestamp;
  } catch (error) {
    console.error('Error getting latest image timestamp:', error);
    return null;
  }
}

/**
 * Process message history for a channel since the given timestamp
 * @param {TextChannel} channel - The Discord channel to process
 * @param {number} sinceTimestamp - Process messages after this timestamp
 */
async function processChannelHistory(channel, sinceTimestamp) {
  try {
    console.log(`Scanning channel: ${channel.name}`);
    
    // Discord timestamps are in milliseconds
    const sinceDate = new Date(sinceTimestamp);
    
    // Get messages in batches
    let lastMessageId = null;
    let messageCount = 0;
    let processedImageCount = 0;
    let hasMoreMessages = true;
    
    while (hasMoreMessages) {
      // Get messages in batches of 100 (Discord API limit)
      const options = { limit: 100 };
      if (lastMessageId) options.before = lastMessageId;
      
      const messages = await channel.messages.fetch(options);
      
      if (messages.size === 0) {
        hasMoreMessages = false;
        break;
      }
      
      // Update lastMessageId for pagination
      lastMessageId = messages.last().id;
      messageCount += messages.size;
      
      // Process each message
      for (const [msgId, message] of messages) {
        // Skip messages from before our timestamp
        if (message.createdTimestamp <= sinceTimestamp) {
          hasMoreMessages = false;
          break;
        }
        
        // Skip bot messages
        if (message.author.bot) continue;
        
        // Check if the message has a zap emoji reaction
        const hasZapReaction = message.reactions.cache.some(reaction => 
          reaction.emoji.name === '⚡' && reaction.count > 0
        );
        
        // Process image attachments
        if (message.attachments.size > 0) {
          for (const [, attachment] of message.attachments) {
            // Check if the attachment is an image
            const fileExtension = path.extname(attachment.name).toLowerCase();
            const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
            
            if (validExtensions.includes(fileExtension)) {
              try {
                // Store Discord CDN URL with metadata
                const metadata = {
                  filename: attachment.name,
                  size: attachment.size,
                  width: attachment.width,
                  height: attachment.height,
                  author: {
                    id: message.author.id,
                    username: message.author.username,
                    displayName: message.author.displayName
                  },
                  messageId: message.id,
                  messageLink: message.url,
                  contentType: attachment.contentType
                };
                
                // If message has zap reaction, add the "react" tag
                if (hasZapReaction) {
                  metadata.imageTags = ['react'];
                }
                
                // Save the URL
                await saveImageUrl(attachment.url, metadata);
                processedImageCount++;
                
                console.log(`Recovered missed image: ${attachment.name}${hasZapReaction ? ' (with zap reaction)' : ''}`);
              } catch (error) {
                // Ignore duplicate image errors
                if (!error.message || !error.message.includes('already exists')) {
                  console.error('Error saving missed image URL:', error);
                } else if (hasZapReaction) {
                  // If it's a duplicate but has a zap reaction, update the tags
                  try {
                    await updateImageTags(attachment.name, ['react']);
                    console.log(`Updated existing image with react tag: ${attachment.name}`);
                  } catch (updateError) {
                    console.error('Error updating image tags:', updateError);
                  }
                }
              }
            }
          }
        }
        
        // Check if the message has embedded images (URLs)
        const urlRegex = /(http(s?):)([/|.|\w|\s|-])*\.(?:jpg|jpeg|gif|png|webp)(\?(?:[a-z0-9_]+==[^&]*)?)|https?:\/\/tenor\.com\/view\/[a-zA-Z0-9-]+/gi;
        const imageUrls = message.content.match(urlRegex);
        
        if (imageUrls) {
          for (const url of imageUrls) {
            // Declare these variables outside the try block so they're accessible in the catch block
            let processedUrl = url;
            let filename = '';
            
            try {
              // Check if the URL is a Discord CDN URL or Tenor URL
              const isDiscordCdn = url.includes('cdn.discordapp.com') || 
                                  url.includes('media.discordapp.net');
              const isTenor = url.includes('tenor.com/view/');
              
              if (isTenor) {
                // Keep the original Tenor URL for proper Discord embedding
                const tenorId = url.split('/').pop();
                filename = `tenor-${tenorId}`;
              } else {
                const urlPath = new URL(url).pathname;
                filename = path.basename(urlPath);
              }
              
              const metadata = {
                filename,
                author: {
                  id: message.author.id,
                  username: message.author.username,
                  displayName: message.author.displayName
                },
                messageId: message.id,
                messageLink: message.url,
                source: isTenor ? 'tenor' : (isDiscordCdn ? 'discord' : 'url'),
              };
              
              // If message has zap reaction, add the "react" tag
              if (hasZapReaction) {
                metadata.imageTags = ['react'];
              }
              
              // Save the URL
              await saveImageUrl(processedUrl, metadata);
              processedImageCount++;
              
              console.log(`Recovered missed image URL: ${filename}${hasZapReaction ? ' (with zap reaction)' : ''}`);
            } catch (error) {
              // Ignore duplicate image errors
              if (!error.message || !error.message.includes('already exists')) {
                console.error('Error saving missed image URL from text:', error);
              } else if (hasZapReaction) {
                // If it's a duplicate but has a zap reaction, update the tags
                try {
                  await updateImageTags(filename, ['react']);
                  console.log(`Updated existing image URL with react tag: ${filename}`);
                } catch (updateError) {
                  console.error('Error updating image URL tags:', updateError);
                }
              }
            }
          }
        }
      }
      
      // If we have less than 100 messages, there are no more to fetch
      if (messages.size < 100) {
        hasMoreMessages = false;
      }
    }
    
    console.log(`Scanned ${messageCount} messages in ${channel.name}, recovered ${processedImageCount} images`);
    
  } catch (error) {
    console.error(`Error processing channel ${channel.name}:`, error);
  }
}

/**
 * Updates the tags for an existing image
 * @param {string} filename - The filename of the image
 * @param {string[]} tagsToAdd - Tags to add to the image
 * @returns {Promise<boolean>} - True if successful, false otherwise
 */
async function updateImageTags(filename, tagsToAdd) {
  try {
    // Find the image by filename
    const snapshot = await imagesCollection.where('filename', '==', filename).limit(1).get();
    
    if (snapshot.empty) {
      return false;
    }
    
    const docRef = snapshot.docs[0].ref;
    const imageData = snapshot.docs[0].data();
    
    // Get current tags or initialize empty array
    const currentTags = imageData.imageTags || [];
    
    // Add new tags (avoiding duplicates)
    const newTags = [...new Set([...currentTags, ...tagsToAdd])];
    
    // Update the document with new tags
    await docRef.update({ imageTags: newTags });
    
    return true;
  } catch (error) {
    console.error('Error updating image tags:', error);
    throw error;
  }
} 