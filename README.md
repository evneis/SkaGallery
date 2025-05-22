# SkaGallery
Discord Bot to save images posted in a Discord for later use.

## Features

- Automatically saves images posted in any channel of your Discord server
- Detects both direct image uploads and image URLs
- Stores image URLs and metadata in Firebase Firestore
- Provides slash commands to interact with the gallery:
  - `/random` - View a random image from the gallery

## Setup

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a Firebase project:
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Click "Add project" and follow the setup steps
   - Once created, add a Web App to your project
   - Enable Firestore Database in your project

4. Copy `templateenv.txt` to `.env` and fill in your credentials:
   ```
   cp templateenv.txt .env
   ```
5. Edit the `.env` file with:
   - Your Discord bot token and client ID
   - Your Firebase configuration (API key, auth domain, project ID, etc.)

6. Deploy slash commands:
   ```
   node deploy-commands.js
   ```
   Note: Commands are registered globally and may take up to an hour to appear in all servers.

7. Start the bot:
   ```
   npm start
   ```

## Firebase Database Structure

The bot uses the following Firestore collections:

- `images` - Stores all image records with the following fields:
  - `url` - The Discord CDN URL of the image
  - `timestamp` - When the image was saved
  - `filename` - Original filename
  - `author` - Information about who posted the image
  - `messageId` - ID of the Discord message containing the image
  - `messageLink` - Link to the original Discord message
  - Various other metadata fields depending on the image source

## Development

- For development with auto-restart on file changes:
  ```
  npm run dev
  ```

## Requirements

- Node.js 16.9.0 or higher
- A Discord bot token from [Discord Developer Portal](https://discord.com/developers/applications)
- A Discord server where you have permission to add bots
- A Firebase project with Cloud Datastore enabled

## License

ISC
