// Date and time helpers reused from the main project

/**
 * Returns the current timestamp in ISO 8601 format.
 */
export function timestamp(): string {
  return new Date().toISOString();
}
