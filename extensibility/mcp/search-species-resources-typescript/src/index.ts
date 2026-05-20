import express, { Request, Response } from 'express';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from 'zod';
import Fuse from 'fuse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  ListResourcesRequestSchema,
  SubscribeRequestSchema,
  UnsubscribeRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { SPECIES_DATA } from './data/species.js';
import { RESOURCES } from './data/resources.js';
import { timestamp, formatSpeciesText } from './utils/utils.js';

const app = express();
app.use(express.json());

// Create the MCP server once (reused across requests)
const server = new Server(
  {
    name: "biological-species-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      resources: { subscribe: true },
      tools: {},
    },
  }
);

// Tool input schemas
const SearchSpeciesDataSchema = z.object({
  searchTerms: z.string().describe("keywords to search for facts about species")
});

const ListSpeciesSchema = z.object({});

// Configure Fuse.js for fuzzy searching
const fuseOptions = {
  keys: ['name', 'description'],
  threshold: 0.4, // 0 = exact match, 1 = match anything
  includeScore: true,
  minMatchCharLength: 2
};

const fuse = new Fuse(RESOURCES, fuseOptions);

// Handler: List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "searchSpeciesData",
        description: "Search for species resources by title keywords. Returns up to 5 matching resource links (text, images, data packages).",
        inputSchema: zodToJsonSchema(SearchSpeciesDataSchema),
      },
      {
        name: "listSpecies",
        description: "Get a list of all available species names in the database.",
        inputSchema: zodToJsonSchema(ListSpeciesSchema),
      },
    ],
  };
});

// Handler: Call tool
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "searchSpeciesData") {
    const validatedArgs = SearchSpeciesDataSchema.parse(args);
    const { searchTerms } = validatedArgs;

    console.log(`${timestamp()} 🔍 Client called tool: searchSpeciesData with terms '${searchTerms}'`);

    // Use Fuse.js for fuzzy search
    const searchResults = fuse.search(searchTerms);
    
    if (searchResults.length === 0) {
      console.log(`${timestamp()} ⚠️  No resources found for client search: "${searchTerms}"`);
      return {
        content: [
          {
            type: "text",
            text: `No resources found matching: "${searchTerms}". Try keywords like 'butterfly', 'panda', 'photo', 'overview', or 'data'.`,
          },
        ],
      };
    }

    // Return top 5 results
    const results = searchResults.slice(0, 5).map(result => result.item);
    console.log(`${timestamp()} ✅ Returning ${results.length} matching resources to client`);

    const content: any[] = [
      {
        type: "text",
        text: `Found ${results.length} resource(s) matching "${searchTerms}":\n\n${results.map((r, i) => `${i + 1}. ${r.name}`).join('\n')}`,
      },
    ];

    // Add resource references
    results.forEach(resource => {
      content.push({
        type: "resource_link",
        uri: resource.uri,
        name: resource.name,
        description: resource.description,
        mimeType: resource.mimeType,
        annotations: {
          audience: ["assistant"],
          priority: 0.8
        }
      });
    });

    return { content };
  }

  if (name === "listSpecies") {
    console.log(`${timestamp()} 📋 Client called tool: listSpecies`);

    // Get only species names
    const speciesNames = SPECIES_DATA.map(species => species.commonName);

    console.log(`${timestamp()} ✅ Returning ${speciesNames.length} species names to client`);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(speciesNames, null, 2),
        },
      ],
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

// Handler: List resources
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  console.log(`${timestamp()} 📋 Client requesting list of all ${RESOURCES.length} resources`);
  
  return {
    resources: RESOURCES.map(r => ({
      uri: r.uri,
      name: r.name,
      description: r.description,
      mimeType: r.mimeType,
    }))
  };
});

// Handler: Read resource
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;

  console.log(`${timestamp()} 📖 Client reading resource: ${uri}`);

  // Find the resource
  const resource = RESOURCES.find(r => r.uri === uri);
  
  if (!resource) {
    throw new Error(`Unknown resource: ${uri}`);
  }

  const species = SPECIES_DATA.find(s => s.id === resource.speciesId);
  
  if (!species) {
    throw new Error(`Species not found for resource: ${uri}`);
  }

  console.log(`${timestamp()} 📄 Client requested: ${species.commonName} - ${resource.resourceType}`);

  // Return content based on resource type
  if (resource.resourceType === 'text') {
    const content = formatSpeciesText(species);
    console.log(`${timestamp()} 📝 Returning text content to client (${content.length} characters)`);
    
    return {
      contents: [
        {
          uri,
          mimeType: "text/plain",
          text: content,
        },
      ],
    };
  }

  if (resource.resourceType === 'image') {
    console.log(`${timestamp()} 🖼️  Returning image to client for ${species.commonName}`);
    
    return {
      contents: [
        {
          uri,
          mimeType: "image/png",
          blob: species.image,
        },
      ],
    };
  }

  throw new Error(`Unknown resource type: ${resource.resourceType}`);
});

// Handler: Subscribe to resource updates
server.setRequestHandler(SubscribeRequestSchema, async (request) => {
  const { uri } = request.params;
  console.log(`${timestamp()} 🔔 Client subscribed to: ${uri}`);
  return {};
});

// Handler: Unsubscribe from resource updates
server.setRequestHandler(UnsubscribeRequestSchema, async (request) => {
  const { uri } = request.params;
  console.log(`${timestamp()} 🔕 Client unsubscribed from: ${uri}`);
  return {};
});

// Handle MCP requests (stateless mode)
app.post('/mcp', async (req: Request, res: Response) => {
  try {
    // Create new transport for each request to prevent request ID collisions
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true
    });

    res.on('close', () => {
      transport.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error(`${timestamp()} Error handling MCP request:`, error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error'
        },
        id: null
      });
    }
  }
});

const PORT = parseInt(process.env.PORT || '3000');
app.listen(PORT, () => {
  console.log(`${timestamp()} 🚀 Species MCP Server running on http://localhost:${PORT}/mcp`);
  console.log(`${timestamp()} 📚 Loaded ${SPECIES_DATA.length} species and ${RESOURCES.length} resources`);
}).on('error', error => {
  console.error(`${timestamp()} Server error:`, error);
  process.exit(1);
});
