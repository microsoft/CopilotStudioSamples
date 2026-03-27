// Simple in-memory resource store mirroring the main project approach

import { GeneratedResource } from '../types.js';
import { timestamp } from '../utils/utils.js';

export const RESOURCES: GeneratedResource[] = [];
let resourceCounter = 0;
const MAX_RESOURCES = 20;

export function createGeneratedResource(text: string): GeneratedResource {
  const createdAt = timestamp();
  const id = ++resourceCounter;

  const resource: GeneratedResource = {
    uri: `generated-text:///${id}`,
    name: `Generated Text #${id}`,
    description: `Randomly generated text created at ${createdAt}`,
    mimeType: 'text/plain',
    createdAt,
    length: text.length,
    resourceType: 'text',
    text,
  };

  RESOURCES.unshift(resource);

  if (RESOURCES.length > MAX_RESOURCES) {
    RESOURCES.pop();
  }

  return resource;
}
