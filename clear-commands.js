import { REST, Routes } from 'discord.js';
import { config } from 'dotenv';

// Load environment variables
config();

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

try {
  console.log('Started clearing application (/) commands.');

  // Clear guild-specific commands if GUILD_ID is defined
  if (process.env.GUILD_ID) {
    console.log(`Clearing commands from guild ${process.env.GUILD_ID}...`);
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: [] }
    );
    console.log(`Successfully cleared guild commands from ${process.env.GUILD_ID}.`);
  } else {
    // Clear global commands only if GUILD_ID is not defined
    console.log('No GUILD_ID specified. Clearing global commands...');
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: [] }
    );
    console.log('Successfully cleared global commands.');
  }

  console.log('All application commands have been cleared.');
} catch (error) {
  console.error(error);
} 