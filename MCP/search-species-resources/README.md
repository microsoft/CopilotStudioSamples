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

## Available Tools

- **`searchSpeciesData`** - Fuzzy search returning up to 5 matching resource references
- **`listSpecies`** - Returns JSON array of all species (id, commonName, scientificName, conservationStatus)

## Available Resources

- 5 species with text overviews and images
- 8 total resources (5 text, 3 images)

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
- [MCP in Copilot Studio][(https://copilotstudio.microsoft.com](https://learn.microsoft.com/en-us/microsoft-copilot-studio/agent-extend-action-mcp)
- [Dev Tunnels](https://learn.microsoft.com/en-us/azure/developer/dev-tunnels/overview)
