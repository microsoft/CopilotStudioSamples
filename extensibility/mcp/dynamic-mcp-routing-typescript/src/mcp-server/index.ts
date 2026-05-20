import express, { Request, Response } from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { instances, projects, projectDetails } from "./data.js";

const PORT = parseInt(process.env.PORT || "3001");

// --- Tool schemas ---

const ListProjectsSchema = z.object({});

const GetProjectDetailsSchema = z.object({
  projectId: z.string().describe("Project identifier"),
});

// --- Factory: creates a configured MCP Server for a given instance ---

function createServer(instanceId: string): Server {
  const instance = instances.find((i) => i.id === instanceId)!;
  const instanceProjects = projects[instanceId];

  const server = new Server(
    {
      name: `${instance.name} MCP Server`,
      version: "1.0.0",
    },
    {
      capabilities: { tools: {} },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "list_projects",
        description: `List all projects in the ${instance.name} instance.`,
        inputSchema: zodToJsonSchema(ListProjectsSchema),
      },
      {
        name: "get_project_details",
        description:
          `Get details for a project in the ${instance.name} instance. ` +
          `Available projects: ${instanceProjects.map((p) => `${p.id} (${p.name})`).join(", ")}`,
        inputSchema: zodToJsonSchema(GetProjectDetailsSchema),
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === "list_projects") {
      return {
        content: [
          { type: "text", text: JSON.stringify(instanceProjects, null, 2) },
        ],
      };
    }

    if (name === "get_project_details") {
      const { projectId } = GetProjectDetailsSchema.parse(args);
      const details = projectDetails[instanceId]?.[projectId];

      if (!details) {
        return {
          content: [
            {
              type: "text",
              text: `Project '${projectId}' not found in ${instance.name}. ` +
                `Available: ${instanceProjects.map((p) => p.id).join(", ")}`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify(details, null, 2) }],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  });

  return server;
}

// --- Express app ---

const app = express();
app.use(express.json());

// POST /instances/:instanceId/mcp — stateless: new transport per request, server per instance
app.post("/instances/:instanceId/mcp", async (req: Request, res: Response) => {
  const { instanceId } = req.params;
  if (!projects[instanceId]) {
    res.status(404).json({ error: `Instance '${instanceId}' not found` });
    return;
  }

  const server = createServer(instanceId);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  res.on("close", () => {
    transport.close();
  });

  await server.connect(transport);

  try {
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error(`Error handling MCP request for ${instanceId}:`, error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

// GET & DELETE — 405
app.get("/instances/:instanceId/mcp", (_req: Request, res: Response) => {
  res.writeHead(405).end(JSON.stringify({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed." },
    id: null,
  }));
});

app.delete("/instances/:instanceId/mcp", (_req: Request, res: Response) => {
  res.writeHead(405).end(JSON.stringify({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed." },
    id: null,
  }));
});

// --- Start ---
app.listen(PORT, () => {
  console.log(`MCP server running on http://localhost:${PORT}`);
  console.log(`\nMCP endpoints:`);
  for (const inst of instances) {
    console.log(`  POST /instances/${inst.id}/mcp`.padEnd(48) + `— ${inst.name}`);
  }
});
