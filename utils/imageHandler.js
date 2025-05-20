import fs from 'fs';
import path from 'path';
import { createWriteStream } from 'fs';
import fetch from 'node-fetch';
import config from '../config.js';

// Ensure storage directory exists
config.ensureStorageExists();

/**
 * Download an image from a URL and save it to the storage directory
 * @param {string} url - The image URL
 * @param {string} filename - The filename to save as
 * @returns {Promise<string>} - The path to the saved image
 */
export async function downloadImage(url, filename) {
  const imagePath = path.join(config.storageDir, filename);
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }
  
  const fileStream = createWriteStream(imagePath);
  await new Promise((resolve, reject) => {
    response.body.pipe(fileStream);
    response.body.on('error', reject);
    fileStream.on('finish', resolve);
  });
  
  return imagePath;
}

/**
 * Get a random image from the storage directory
 * @returns {Promise<string|null>} - The path to a random image, or null if none exist
 */
export function getRandomImage() {
  const files = fs.readdirSync(config.storageDir);
  const imageFiles = files.filter(file => {
    const ext = path.extname(file).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
  });
  
  if (imageFiles.length === 0) {
    return null;
  }
  
  const randomIndex = Math.floor(Math.random() * imageFiles.length);
  return path.join(config.storageDir, imageFiles[randomIndex]);
}

/**
 * Get all images in the storage directory
 * @returns {string[]} - Array of image paths
 */
export function getAllImages() {
  const files = fs.readdirSync(config.storageDir);
  return files
    .filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
    })
    .map(file => path.join(config.storageDir, file));
}

/**
 * Get image metadata (basic version)
 * @param {string} imagePath - Path to the image
 * @returns {Object} - Image metadata
 */
export function getImageMetadata(imagePath) {
  const stats = fs.statSync(imagePath);
  return {
    filename: path.basename(imagePath),
    size: stats.size,
    created: stats.birthtime,
    modified: stats.mtime
  };
} 