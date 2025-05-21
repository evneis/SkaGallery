import { REST, Routes } from 'discord.js';
import { config } from 'dotenv';

// Load environment variables
config();

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

try {
  console.log('Started clearing application (/) commands.');

  // Clear guild-specific commands
  await rest.put(
    Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
    { body: [] }
  );

  // Clear global commands
  await rest.put(
    Routes.applicationCommands(process.env.CLIENT_ID),
    { body: [] }
  );

  console.log('Successfully cleared all application commands.');
} catch (error) {
  console.error(error);
} 