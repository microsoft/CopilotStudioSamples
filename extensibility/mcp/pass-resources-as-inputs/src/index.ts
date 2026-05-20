import express, { Request, Response } from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  SubscribeRequestSchema,
  UnsubscribeRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { createGeneratedResource, RESOURCES } from './data/resources.js';
import { generateRandomText, randomInt, timestamp } from './utils/utils.js';

const app = express();

// Basic CORS allowance so hosted transports can call the MCP endpoint
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header(
    'Access-Control-Allow-Headers',
    req.header('Access-Control-Request-Headers') ?? 'Content-Type, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }

  next();
});

app.use(express.json());

const server = new Server(
  {
    name: 'text-generator-mcp-server',
    version: '0.1.0',
  },
  {
    capabilities: {
      resources: { subscribe: true },
      tools: {},
    },
  }
);

const GenerateTextSchema = z.object({});

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

const toJsonSchema = (schema: unknown) => zodToJsonSchema(schema as any);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'generate_text',
      description: 'Generate 10k-100k characters of placeholder text and publish it as a resource.',
      inputSchema: toJsonSchema(GenerateTextSchema),
    },
    {
      name: 'count_characters',
      description: 'Return the length of the provided text or resource.',
      inputSchema: toJsonSchema(CountCharactersSchema),
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
  const { name, arguments: args } = request.params;

  if (name === 'generate_text') {
    GenerateTextSchema.parse(args ?? {});
    const targetLength = randomInt(30_000, 300_000);
    const text = generateRandomText(targetLength);
    const resource = createGeneratedResource(text);

    console.log(`${timestamp()} 🆕 Generated resource ${resource.uri} (${resource.length} chars)`);

    return {
      content: [
        {
          type: 'text',
          text: `Generated resource ${resource.uri}.`,
        },
        {
          type: 'resource_link',
          uri: resource.uri,
          name: resource.name,
          description: resource.description,
          mimeType: resource.mimeType,
          annotations: {
            audience: ['assistant'],
            priority: 0.5,
          },
        },
      ],
    };
  }

  if (name === 'count_characters') {
    const { text, resourceUri } = CountCharactersSchema.parse(args ?? {});
    let sourceLabel = 'direct text input';
    let inputText = text ?? '';

    if (resourceUri) {
      const resource = RESOURCES.find((r) => r.uri === resourceUri);

      if (!resource) {
        throw new Error(`Unknown resource: ${resourceUri}`);
      }

      if (resource.resourceType !== 'text') {
        throw new Error(`Unsupported resource type: ${resource.resourceType}`);
      }

      inputText = resource.text;
      sourceLabel = `resource ${resourceUri}`;
    }

    const result = inputText.length;

    console.log(`${timestamp()} 🔢 count_characters called (${sourceLabel}, len=${result})`);

    return {
      content: [
        {
          type: 'text',
          text: resourceUri
            ? `Character count for ${resourceUri}: ${result}`
            : `Character count: ${result}`,
        },
      ],
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  console.log(`${timestamp()} 📋 Client requesting list of all ${RESOURCES.length} resources`);

  return {
    resources: RESOURCES.map((resource) => ({
      uri: resource.uri,
      name: resource.name,
      description: resource.description,
      mimeType: resource.mimeType,
    })),
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request: any) => {
  const uri = request.params.uri;

  console.log(`${timestamp()} 📖 Client reading resource: ${uri}`);

  const resource = RESOURCES.find((r) => r.uri === uri);

  if (!resource) {
    throw new Error(`Unknown resource: ${uri}`);
  }

  console.log(`${timestamp()} 📄 Client requested: ${resource.name} - ${resource.resourceType}`);

  if (resource.resourceType === 'text') {
    const content = resource.text;
    console.log(`${timestamp()} 📝 Returning text content to client (${content.length} characters)`);

    return {
      contents: [
        {
          uri,
          mimeType: 'text/plain',
          text: content,
        },
      ],
    };
  }

  throw new Error(`Unknown resource type: ${resource.resourceType}`);
});

server.setRequestHandler(SubscribeRequestSchema, async (request: any) => {
  console.log(`${timestamp()} 🔔 Subscription for ${request.params.uri}`);
  return {};
});

server.setRequestHandler(UnsubscribeRequestSchema, async (request: any) => {
  console.log(`${timestamp()} 🔕 Unsubscribed from ${request.params.uri}`);
  return {};
});

app.post('/mcp', async (req: Request, res: Response) => {
  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    res.on('close', () => transport.close());

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error(`${timestamp()} ❌ MCP request failed`, error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
        },
        id: null,
      });
    }
  }
});

const PORT = parseInt(process.env.PORT || '3456', 10);
app
  .listen(PORT, () => {
    console.log(`${timestamp()} 🚀 Text MCP Server ready at http://localhost:${PORT}/mcp`);
  })
  .on('error', (error: unknown) => {
    console.error(`${timestamp()} Server error`, error);
    process.exit(1);
  });

