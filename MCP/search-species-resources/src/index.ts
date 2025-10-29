import express, { Request, Response } from 'express';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from 'zod';
import Fuse from 'fuse.js';

// Define our hardcoded resources about biological species
interface Species {
  id: string;
  commonName: string;
  scientificName: string;
  description: string;
  habitat: string;
  diet: string;
  conservationStatus: string;
  interestingFacts: string[];
  tags: string[];
}

const SPECIES_RESOURCES: Species[] = [
  {
    id: "african-elephant",
    commonName: "African Elephant",
    scientificName: "Loxodonta africana",
    description: "The African elephant is the largest living terrestrial animal. Adult males can reach up to 4 meters in height and weigh up to 7,000 kg. They are distinguished by their large ears, which help dissipate heat in the African climate.",
    habitat: "African savannas, forests, and deserts across sub-Saharan Africa",
    diet: "Herbivore - grasses, leaves, bark, fruit, and roots. Can consume up to 150 kg of vegetation daily.",
    conservationStatus: "Endangered",
    interestingFacts: [
      "Elephants have the longest pregnancy of any mammal - 22 months",
      "They can recognize themselves in mirrors, showing self-awareness",
      "African elephants communicate through infrasound that can travel several kilometers",
      "Their tusks are actually elongated incisor teeth made of ivory"
    ],
    tags: ["mammal", "herbivore", "endangered", "africa", "savanna", "large-animal"]
  },
  {
    id: "monarch-butterfly",
    commonName: "Monarch Butterfly",
    scientificName: "Danaus plexippus",
    description: "The Monarch butterfly is famous for its distinctive orange and black wing pattern and its incredible multi-generational migration. They are one of the few insects that make a trans-continental migration.",
    habitat: "North America, with migration routes between Mexico/California and Canada/United States",
    diet: "Larvae feed exclusively on milkweed plants; adults feed on nectar from various flowers",
    conservationStatus: "Vulnerable",
    interestingFacts: [
      "Their migration can span up to 4,800 km (3,000 miles)",
      "It takes 3-4 generations to complete the full migration cycle",
      "Milkweed makes them toxic to most predators",
      "They use the Earth's magnetic field and sun position for navigation"
    ],
    tags: ["insect", "butterfly", "migration", "herbivore", "north-america", "endangered"]
  },
  {
    id: "great-white-shark",
    commonName: "Great White Shark",
    scientificName: "Carcharodon carcharias",
    description: "The great white shark is the world's largest predatory fish. These apex predators can grow up to 6 meters in length and have up to 300 serrated triangular teeth arranged in several rows.",
    habitat: "Coastal surface waters in all major oceans, particularly in temperate and subtropical regions",
    diet: "Carnivore - marine mammals (seals, sea lions), fish, sea turtles, and carrion",
    conservationStatus: "Vulnerable",
    interestingFacts: [
      "Can detect a single drop of blood in 100 liters of water",
      "Their teeth are constantly replaced throughout their lifetime",
      "Can breach completely out of the water when hunting seals",
      "Great whites can live up to 70 years or more"
    ],
    tags: ["fish", "shark", "carnivore", "marine", "predator", "vulnerable"]
  },
  {
    id: "red-panda",
    commonName: "Red Panda",
    scientificName: "Ailurus fulgens",
    description: "The red panda is a small arboreal mammal native to the eastern Himalayas. Despite their name and appearance, red pandas are not closely related to giant pandas - they're in their own unique family, Ailuridae.",
    habitat: "Temperate forests in the Himalayas, at elevations between 2,200-4,800 meters",
    diet: "Primarily bamboo (95% of diet), but also eggs, birds, insects, and small mammals",
    conservationStatus: "Endangered",
    interestingFacts: [
      "They have a false thumb - an extended wrist bone that helps grip bamboo",
      "Red pandas sleep 17 hours a day, often in trees",
      "Their thick fur and bushy tail help them stay warm in cold mountain climates",
      "They use their tail for balance and as a blanket in cold weather"
    ],
    tags: ["mammal", "herbivore", "endangered", "asia", "himalaya", "arboreal"]
  },
  {
    id: "poison-dart-frog",
    commonName: "Poison Dart Frog",
    scientificName: "Dendrobatidae (family)",
    description: "Poison dart frogs are a family of brightly colored frogs found in Central and South America. Their vibrant colors warn predators of their toxic skin. Indigenous peoples used their poison for hunting darts, hence the name.",
    habitat: "Tropical rainforests of Central and South America, near streams and on the forest floor",
    diet: "Carnivore - primarily ants, termites, and small arthropods. Their toxicity comes from their diet.",
    conservationStatus: "Varies by species - some critically endangered",
    interestingFacts: [
      "Captive-bred frogs are not poisonous as they don't have access to the insects that provide toxins",
      "Males carry tadpoles on their backs to water sources",
      "The golden poison dart frog has enough toxin to kill 10 adult humans",
      "Their bright colors are an example of aposematic coloration (warning colors)"
    ],
    tags: ["amphibian", "frog", "carnivore", "tropical", "rainforest", "toxic", "endangered"]
  }
];

const server = new McpServer({
  name: "biological-species-mcp-server",
  version: "1.0.0",
  description: "MCP server for accessing information about biological species. Provides a search tool to find species based on questions or keywords."
});

// Helper function to format species data as text
function formatSpeciesText(species: Species): string {
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

// Configure Fuse.js for fuzzy searching
const fuse = new Fuse(SPECIES_RESOURCES, {
  keys: [
    { name: 'commonName', weight: 2 },
    { name: 'scientificName', weight: 1.5 },
    { name: 'description', weight: 1 },
    { name: 'habitat', weight: 0.8 },
    { name: 'diet', weight: 0.8 },
    { name: 'conservationStatus', weight: 0.5 },
    { name: 'tags', weight: 1.5 },
    { name: 'interestingFacts', weight: 0.7 }
  ],
  threshold: 0.4, // Lower = more strict matching (0-1)
  includeScore: true,
  minMatchCharLength: 2
});

// Register static resources for each species
SPECIES_RESOURCES.forEach((species) => {
  server.registerResource(
    species.id,
    `species:///${species.id}`,
    {
      title: `${species.commonName} (${species.scientificName})`,
      description: species.description,
      mimeType: 'text/plain'
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          text: formatSpeciesText(species)
        }
      ]
    })
  );
});

// Tool: Search for species based on a question
server.tool(
  "searchSpecies",
  "Search for biological species using lexical search terms (keywords). Supports fuzzy matching across species names, habitat, diet, conservation status, and other attributes. Returns a resource link to the most relevant species.",
  {
    searchTerms: z.string().describe("Lexical search keywords to find relevant species (e.g., 'endangered africa', 'butterfly migration', 'marine predator')"),
  },
  async ({ searchTerms }) => {
    // Use Fuse.js for fuzzy search
    const results = fuse.search(searchTerms);

    if (results.length === 0) {
      const availableSpecies = SPECIES_RESOURCES.map(
        (s) => `- ${s.commonName} (${s.scientificName}): ${s.description.substring(0, 100)}...`
      ).join("\n");
      
      return {
        content: [{
          type: "text",
          text: `No relevant species found for: "${searchTerms}"\n\nAvailable species:\n${availableSpecies}`
        }]
      };
    }

    const species = results[0].item;
    
    // Return resource link to the found species
    return {
      content: [
        {
          type: "resource",
          resource: {
            uri: `species:///${species.id}`,
            mimeType: "text/plain",
            text: formatSpeciesText(species)
          }
        }
      ]
    };
  }
);

const app = express();

app.use(express.json());

const transport: StreamableHTTPServerTransport =
  new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, 
  });

const setupServer = async () => {
  await server.connect(transport);
};

// Helper to format timestamp
function timestamp(): string {
  return new Date().toISOString().substring(11, 23); 
}

// Helper to get emoji for method type
function getMethodEmoji(method: string): string {
  if (method.startsWith('tools/')) return '🔧';
  if (method.startsWith('resources/')) return '📚';
  if (method.startsWith('notifications/')) return '🔔';
  if (method === 'initialize') return '🚀';
  return '📡';
}

app.post("/mcp", async (req: Request, res: Response) => {
  const method = req.body?.method;
  if (method) {
    const emoji = getMethodEmoji(method);
    console.log(`${timestamp()} ${emoji} ${method}`);
  }
  
  try {
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error(`${timestamp()} ❌ Error:`, error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
        },
        id: null,
      });
    }
  }
});

app.get("/mcp", async (req: Request, res: Response) => {
  res.writeHead(405).end(
    JSON.stringify({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Method not allowed.",
      },
      id: null,
    })
  );
});

app.delete("/mcp", async (req: Request, res: Response) => {
  res.writeHead(405).end(
    JSON.stringify({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Method not allowed.",
      },
      id: null,
    })
  );
});

const PORT = process.env.PORT || 3000;
setupServer()
  .then(() => {
    app.listen(PORT, () => {
      console.log('\n' + '='.repeat(60));
      console.log('🌿 Biological Species MCP Server');
      console.log('='.repeat(60));
      console.log(`📡 Server listening on port ${PORT}`);
      console.log(`🔗 Endpoint: http://localhost:${PORT}/mcp`);
      console.log(`📚 Resources: ${SPECIES_RESOURCES.length} species available`);
      console.log(`🔧 Tool: searchSpecies`);
      console.log('='.repeat(60) + '\n');
    });
  })
  .catch((error) => {
    console.error("Failed to set up the server:", error);
    process.exit(1);
  });
