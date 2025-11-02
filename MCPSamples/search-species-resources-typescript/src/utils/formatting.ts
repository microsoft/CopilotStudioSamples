// Formatting utilities for species data

import { Species } from '../types.js';

/**
 * Formats species data as human-readable text
 * @param species - The species object to format
 * @returns Formatted text representation of the species
 */
export function formatSpeciesText(species: Species): string {
  return `Common Name: ${species.commonName}
Scientific Name: ${species.scientificName}

Description:
${species.description}

Habitat:
${species.habitat}

Diet:
${species.diet}

Conservation Status: ${species.conservationStatus}

Interesting Facts:
${species.interestingFacts.map((fact, i) => `${i + 1}. ${fact}`).join('\n')}

Tags: ${species.tags.join(', ')}`;
}
