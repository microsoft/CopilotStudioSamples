import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Reads an image file from the assets folder and converts it to base64
 * @param filename - The name of the image file (e.g., 'blue-whale.png')
 * @returns Base64-encoded string of the image
 */
export function encodeImage(filename: string): string {
  try {
    const imagePath = path.join(__dirname, '..', 'assets', filename);
    const imageBuffer = fs.readFileSync(imagePath);
    return imageBuffer.toString('base64');
  } catch (error) {
    console.error(`Error encoding image ${filename}:`, error);
    return '';
  }
}

/**
 * Gets the data URI for an image (includes mime type prefix)
 * @param filename - The name of the image file (e.g., 'blue-whale.png')
 * @returns Data URI string (e.g., 'data:image/png;base64,...')
 */
export function getImageDataUri(filename: string): string {
  const base64 = encodeImage(filename);
  if (!base64) return '';
  
  const ext = path.extname(filename).toLowerCase();
  const mimeType = ext === '.png' ? 'image/png' : 
                   ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 
                   'image/png';
  
  return `data:${mimeType};base64,${base64}`;
}
