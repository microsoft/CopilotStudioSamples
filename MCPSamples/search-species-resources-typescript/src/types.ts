// Type definitions for the species resource server

export interface Species {
  id: string;
  commonName: string;
  scientificName: string;
  description: string;
  habitat: string;
  diet: string;
  conservationStatus: string;
  interestingFacts: string[];
  tags: string[];
  image?: string; // Optional: Base64 encoded PNG image data
}

export interface SpeciesResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  speciesId: string;
  resourceType: 'text' | 'image';
}
