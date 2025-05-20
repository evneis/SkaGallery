# SkaGallery
Discord Bot to save images posted in a Discord for later use.

## Features

- Automatically saves images posted in a specified Discord channel
- Detects both direct image uploads and image URLs
- Provides slash commands to interact with the gallery:
  - `/random` - View a random image from the gallery
  - `/count` - See how many images are in the gallery

## Setup

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Copy `template.env` to `.env` and fill in your Discord credentials:
   ```
   cp template.env .env
   ```
4. Edit the `.env` file with your Discord bot token, client ID, guild ID, and gallery channel ID
5. Deploy slash commands to your server:
   ```
   node deploy-commands.js
   ```
6. Start the bot:
   ```
   npm start
   ```

## Development

- For development with auto-restart on file changes:
  ```
  npm run dev
  ```

## Requirements

- Node.js 16.9.0 or higher
- A Discord bot token from [Discord Developer Portal](https://discord.com/developers/applications)
- A Discord server where you have permission to add bots

## License

ISC