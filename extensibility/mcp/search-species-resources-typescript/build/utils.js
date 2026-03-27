// Utility functions for the species resource server
// Helper function for timestamps
export function timestamp() {
    return new Date().toISOString();
}
// Helper function to format species data as text
export function formatSpeciesText(species) {
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
