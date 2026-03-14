# Biological Species MCP Server

An MCP server demonstrating resource discovery through tools. Copilot Studio always accesses resources through tools, not directly - a design motivated by enterprise environments with large-scale resource catalogs.

## Architecture

**How Copilot Studio accesses MCP resources:**
- Copilot Studio uses tools to discover resources (never enumerates all resources directly)
- Tools return filtered resource references (e.g., search returns 5 matches)
- Agent evaluates references and selectively reads chosen resources
- Design enables scalability for enterprise systems with large resource catalogs

**Note:** The MCP protocol supports direct resource enumeration, but Copilot Studio's architecture always uses tool-based discovery.

This server implements a simple search pattern with fuzzy matching.

## How It Works

**1. Define Your Resources**

Resources are dynamically generated from a species database:

```typescript
// Species data with details
export const SPECIES_DATA: Species[] = [
  {
    id: "monarch-butterfly",
    commonName: "Monarch Butterfly",
    scientificName: "Danaus plexippus",
    description: "Famous for its distinctive orange and black wing pattern...",
    habitat: "North America, with migration routes...",
    diet: "Larvae feed on milkweed; adults feed on nectar",
    conservationStatus: "Vulnerable",
    interestingFacts: [...],
    tags: ["insect", "butterfly", "migration"],
    image: encodeImage("butterfly.png")
  },
  // ... more species
];

// Resources generated from species data
export const RESOURCES: SpeciesResource[] = [
  {
    uri: "species://blue-whale/overview",
    name: "Blue Whale Overview",
    description: "Comprehensive information about blue whales",
    mimeType: "text/plain",
    speciesId: "blue-whale",
    resourceType: "text"
  },
  {
    uri: "species://blue-whale/photo",
    name: "Blue Whale Photo",
    description: "High-resolution photo of a blue whale",
    mimeType: "image/png",
    speciesId: "blue-whale",
    resourceType: "image"
  },
  // ... more resources
];
```

This generates 8 resources from 5 species (5 text overviews + 3 images).

**2. Implement Search Tool**

The `searchSpeciesData` tool uses Fuse.js for fuzzy matching and returns `resource_link` references:

```typescript
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "searchSpeciesData") {
    const searchResults = fuse.search(searchTerms);
    const topResults = searchResults.slice(0, 5);

    // Return resource references, not full content
    const content = [
      {
        type: "text",
        text: `Found ${topResults.length} resources matching "${searchTerms}"`
      }
    ];

    topResults.forEach(result => {
      content.push({
        type: "resource_link",
        uri: result.item.uri,
        name: result.item.name,
        description: result.item.description,
        mimeType: result.item.mimeType,
        annotations: {
          audience: ["assistant"],
          priority: 0.8
        }
      });
    });

    return { content };
  }
});
```

**3. Handle Resource Reads**

When the agent sends `resources/read` requests, your server provides the full content:

```typescript
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;
  const resource = RESOURCES.find(r => r.uri === uri);
  const species = SPECIES_DATA.find(s => s.id === resource.speciesId);

  if (resource.resourceType === 'text') {
    return {
      contents: [{
        uri,
        mimeType: "text/plain",
        text: formatSpeciesText(species)
      }]
    };
  }

  if (resource.resourceType === 'image') {
    return {
      contents: [{
        uri,
        mimeType: "image/png",
        blob: species.image  // Base64-encoded PNG
      }]
    };
  }
});
```

## Sample Structure

```
src/
├── index.ts              # Server entry point
├── types.ts              # TypeScript types
├── data/
│   ├── species.ts        # Species data (5 species)
│   └── resources.ts      # Resource definitions (8 resources)
├── assets/               # PNG images
└── utils/                # Utilities (datetime, formatting, image encoding)
```

## Quick Start

### Prerequisites

- Node.js 18+
- [Dev Tunnels CLI](https://learn.microsoft.com/en-us/azure/developer/dev-tunnels/get-started)
- Copilot Studio access

### 1. Install and Build

```bash
npm install
npm run build
```

### 2. Start Server

```bash
npm start
# or
npm run dev
```

Server runs on `http://localhost:3000/mcp`

### 3. Create Dev Tunnel

**VS Code:**
1. Ports panel → Forward Port → 3000
2. Right-click → Port Visibility → Public
3. Copy HTTPS URL

**CLI:**
```bash
devtunnel host -p 3000 --allow-anonymous
```

**Important:** URL format is `https://abc123-3000.devtunnels.ms/mcp` (port in hostname with hyphen, not colon)

### 4. Configure Copilot Studio

1. Navigate to Tools → Add tool → Model Context Protocol
2. Configure:
   - **Server URL:** `https://your-tunnel-3000.devtunnels.ms/mcp`
   - **Authentication:** None
3. Click Create

## Example Queries

```
What species do you have?
→ Calls listSpecies()

Tell me about butterflies
→ Calls searchSpeciesData("butterflies") → Returns Monarch Butterfly resources

Show me a blue whale photo
→ Calls searchSpeciesData("blue whale photo") → Returns image resource
```

## Development

### Adding Species

1. Add to `src/data/species.ts`
2. Add PNG to `src/assets/`
3. Add resources to `src/data/resources.ts`
4. Rebuild: `npm run build`

## Resources

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP in Copilot Studio][(https://copilotstudio.microsoft.com](https://learn.microsoft.com/en-us/microsoft-copilot-studio/agent-extend-action-mcp))
- [Dev Tunnels](https://learn.microsoft.com/en-us/azure/developer/dev-tunnels/overview)
