import sharp from 'sharp';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

/**
 * Create a 3x3 collage from an array of images
 * @param {Array} images - Array of image objects with url/filePath
 * @returns {Promise<Buffer>} - Buffer containing the collage image
 */
export async function createCollage(images) {
  const collageSize = 900; // 900x900 final collage
  const cellSize = 300; // Each cell is 300x300
  const rows = 3;
  const cols = 3;
  
  // Ensure we have at most 9 images
  const selectedImages = images.slice(0, 9);
  
  console.log(`Creating collage with ${selectedImages.length} images`);
  
  // Create array to hold processed image buffers
  const imageBuffers = [];
  
  // Process each image
  for (let i = 0; i < selectedImages.length; i++) {
    try {
      const imageData = selectedImages[i];
      let imageBuffer;
      
      // Get image buffer based on source
      if (imageData.url.startsWith('http')) {
        // It's a URL, fetch it
        console.log(`Fetching image from URL: ${imageData.url}`);
        const response = await fetch(imageData.url);
        
        if (!response.ok) {
          console.warn(`Failed to fetch image ${i + 1}, skipping...`);
          continue;
        }
        
        imageBuffer = Buffer.from(await response.arrayBuffer());
      } else {
        // It's a local file path
        console.log(`Reading local image: ${imageData.url}`);
        
        if (!fs.existsSync(imageData.url)) {
          console.warn(`Local file does not exist: ${imageData.url}, skipping...`);
          continue;
        }
        
        imageBuffer = await fs.promises.readFile(imageData.url);
      }
      
      // Resize and crop the image to fit the cell
      const processedImage = await sharp(imageBuffer)
        .resize(cellSize, cellSize, {
          fit: 'cover', // This crops to fill the entire cell
          position: 'center'
        })
        .png() // Convert to PNG for consistency
        .toBuffer();
      
      imageBuffers.push(processedImage);
      
    } catch (error) {
      console.error(`Error processing image ${i + 1}:`, error);
      // Continue with other images
    }
  }
  
  if (imageBuffers.length === 0) {
    throw new Error('No images could be processed for the collage');
  }
  
  console.log(`Successfully processed ${imageBuffers.length} images`);
  
  // Create the base collage canvas
  const collageCanvas = sharp({
    create: {
      width: collageSize,
      height: collageSize,
      channels: 3,
      background: { r: 255, g: 255, b: 255 } // White background
    }
  });
  
  // Create composite array for positioning images
  const composite = [];
  
  for (let i = 0; i < imageBuffers.length; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    
    const left = col * cellSize;
    const top = row * cellSize;
    
    composite.push({
      input: imageBuffers[i],
      left: left,
      top: top
    });
  }
  
  // Fill remaining cells with placeholder if we have fewer than 9 images
  for (let i = imageBuffers.length; i < 9; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    
    const left = col * cellSize;
    const top = row * cellSize;
    
    // Create a gray placeholder
    const placeholder = await sharp({
      create: {
        width: cellSize,
        height: cellSize,
        channels: 3,
        background: { r: 240, g: 240, b: 240 }
      }
    })
    .png()
    .toBuffer();
    
    composite.push({
      input: placeholder,
      left: left,
      top: top
    });
  }
  
  // Composite all images onto the canvas
  const finalCollage = await collageCanvas
    .composite(composite)
    .png()
    .toBuffer();
  
  console.log('Collage created successfully');
  return finalCollage;
} 