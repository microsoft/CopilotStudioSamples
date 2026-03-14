# Pass Resources As Inputs MCP Server

An MCP server demonstrating how tools can accept either inline text or resource references. Copilot Studio sends only lightweight inputs (like `resourceUri`) while the server keeps multi‑kilobyte payloads in its resource catalog, preventing the agent context window from getting saturated.

## Architecture

**How Copilot Studio keeps large payloads out of the agent context:**
- Tools such as `generate_text` emit `resource_link` references instead of streaming kilobytes of text back to the agent
- The agent passes the chosen `resourceUri` to `count_characters`, so only a small pointer crosses the wire
- The server resolves the resource internally and returns the computed metadata (character counts) as compact text
- Design keeps context usage predictable and showcases how MCP tools can chain resource creation and consumption

**Note:** Even if the MCP protocol supports sending full text inputs, this sample favors passing resource identifiers to keep agent context window lean.

This server focuses on a single hand-off pattern: generate large text once, reuse it everywhere via resource IDs.

## How It Works

**1. Generate Large Text Resources**

`generate_text` creates 30k–300k characters of placeholder prose, publishes it as a resource, and returns a link:

```typescript
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
```

The server keeps only the 20 most recent resources in memory, mirroring how larger catalogs might evict stale entries.

**2. Accept Either Text or Resource Inputs**

`count_characters` uses a Zod schema that enforces one of `text` or `resourceUri`:

```typescript
const CountCharactersSchema = z
  .object({
    text: z.string().describe('Text to count characters for').optional(),
    resourceUri: z
      .string()
      .describe('URI of a text resource whose characters should be counted')
      .optional(),
  })
  .refine((data) => data.text || data.resourceUri, {
    message: 'Provide either text or resourceUri',
    path: ['text'],
  });
```

The schema is converted to JSON Schema so Copilot Studio can render the input UI automatically.

**3. Resolve Resource IDs Server-Side**

When a `resourceUri` is provided, the server loads the full text locally, counts characters, and returns only the result:

```typescript
if (name === 'count_characters') {
  const { text, resourceUri } = CountCharactersSchema.parse(args ?? {});
  let inputText = text ?? '';

  if (resourceUri) {
    const resource = RESOURCES.find((r) => r.uri === resourceUri);
    if (!resource || resource.resourceType !== 'text') {
      throw new Error(`Unknown resource: ${resourceUri}`);
    }

    inputText = resource.text;
  }

  return {
    content: [
      {
        type: 'text',
        text: resourceUri
          ? `Character count for ${resourceUri}: ${inputText.length}`
          : `Character count: ${inputText.length}`,
      },
    ],
  };
}
```

The agent never receives the massive text, only the final character count.

## Sample Structure

```
src/
├── index.ts              # Express transport + MCP handlers
├── types.ts              # Shared GeneratedResource interface
├── data/
│   └── resources.ts      # In-memory resource catalog (20 latest entries)
└── utils/
    ├── datetime.ts       # ISO timestamp helper
    ├── text.ts           # Random text + RNG helpers
    └── utils.ts          # Barrel exports
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

Server runs on `http://localhost:3456/mcp`

### 3. Create Dev Tunnel

**VS Code:**
1. Ports panel → Forward Port → 3456
2. Right-click → Port Visibility → Public
3. Copy HTTPS URL

**CLI:**
```bash
devtunnel host -p 3456 --allow-anonymous
```

**Important:** URL format is `https://abc123-3456.devtunnels.ms/mcp` (port in hostname with hyphen, not colon)

### 4. Configure Copilot Studio

1. Navigate to Tools → Add tool → Model Context Protocol
2. Configure:
   - **Server URL:** `https://your-tunnel-3456.devtunnels.ms/mcp`
   - **Authentication:** None
3. Click Create

## Example Queries

```
Generate some placeholder text
→ Calls generate_text() and returns a resource link

How many characters are in generated-text:///3?
→ Calls count_characters({ "resourceUri": "generated-text:///3" })

Count the characters in "quick brown fox"
→ Calls count_characters({ "text": "quick brown fox" })
```

## Development

### Tweaking Text Generation

1. Update `src/utils/text.ts` to change the word bank or target lengths
2. Adjust `MAX_RESOURCES` in `src/data/resources.ts` to keep more (or fewer) generated entries
3. Rebuild: `npm run build`

## Resources

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP in Copilot Studio](https://learn.microsoft.com/en-us/microsoft-copilot-studio/agent-extend-action-mcp)
- [Dev Tunnels](https://learn.microsoft.com/en-us/azure/developer/dev-tunnels/overview)
