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
    image?: string;
}
export interface SpeciesResource {
    uri: string;
    name: string;
    description: string;
    mimeType: string;
    speciesId: string;
    resourceType: 'text' | 'image';
}
