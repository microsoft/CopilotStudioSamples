/**
 * Reads an image file from the assets folder and converts it to base64
 * @param filename - The name of the image file (e.g., 'blue-whale.png')
 * @returns Base64-encoded string of the image
 */
export declare function encodeImage(filename: string): string;
/**
 * Gets the data URI for an image (includes mime type prefix)
 * @param filename - The name of the image file (e.g., 'blue-whale.png')
 * @returns Data URI string (e.g., 'data:image/png;base64,...')
 */
export declare function getImageDataUri(filename: string): string;
