// Date and time utility functions

/**
 * Returns the current timestamp in ISO 8601 format
 * @returns ISO 8601 formatted timestamp string
 */
export function timestamp(): string {
  return new Date().toISOString();
}
