import { REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import botConfig from './config.js';

// Load environment variables
config();

// Set up file paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  // Convert the filePath to a file URL
  const fileUrl = `file://${filePath.replace(/\\/g, '/')}`;
  const command = await import(fileUrl);
  
  if ('data' in command && 'execute' in command) {
    commands.push(command.data.toJSON());
  } else {
    console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
  }
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

try {
  console.log(`Started refreshing ${commands.length} application (/) commands.`);
  
  // Check if we have any guild IDs configured
  if (botConfig.guildIds.length > 0) {
    console.log(`Deploying commands to ${botConfig.guildIds.length} guilds...`);
    
    // Deploy to each guild in the array
    for (const guildId of botConfig.guildIds) {
      const data = await rest.put(
        Routes.applicationGuildCommands(
          process.env.CLIENT_ID,
          guildId
        ),
        { body: commands },
      );
      
      console.log(`Successfully reloaded ${data.length} application (/) commands for guild ${guildId}.`);
    }
  } else {
    // If no guild IDs specified, deploy globally
    console.log('No guild IDs specified. Deploying commands globally (may take up to 1 hour to update).');
    const data = await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands },
    );
    
    console.log(`Successfully reloaded ${data.length} application (/) commands globally.`);
  }
} catch (error) {
  console.error(error);
} 