// Resource definitions - dynamically generated from species data

import { SpeciesResource } from '../types.js';
import { SPECIES_DATA } from './species.js';

// Dynamically generate resources from species data
export const RESOURCES: SpeciesResource[] = SPECIES_DATA.flatMap(species => {
  const resources: SpeciesResource[] = [
    // Text resource for each species
    {
      uri: `species:///${species.id}/info`,
      name: `${species.commonName} - Species Overview`,
      description: `Detailed information about the ${species.commonName} including habitat, diet, and conservation status`,
      mimeType: "text/plain",
      speciesId: species.id,
      resourceType: "text"
    }
  ];

  // Add image resource only if the species has an image
  if (species.image) {
    resources.push({
      uri: `species:///${species.id}/image`,
      name: `${species.commonName} - Photo`,
      description: `Photograph of ${species.commonName}`,
      mimeType: "image/png",
      speciesId: species.id,
      resourceType: "image"
    });
  }

  return resources;
});
