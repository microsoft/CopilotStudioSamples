import express, { NextFunction, Request, Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { z } from "zod";
import { gate, toToolOutput } from "./gate.js";
import { createRetriever, Retriever } from "./search.js";

const CANDIDATES = Number(process.env.GATE_CANDIDATES ?? 12);

export function createMcpServer(client: TypeSafeClient, retriever: Retriever): McpServer {
  const server = new McpServer({ name: "jev-evidence-gate", version: "1.0.0" });

  server.registerTool(
    "search_procedures",
    {
      title: "Search maintenance procedures",
      description:
        "Search the maintenance and safety procedure library and return only the passages that answer the question. " +
        "Always call this tool before answering a question about equipment, maintenance or safety. " +
        "Follow the `guidance` field of the result: answer only from `evidence`, report `conflicts`, " +
        "and when `status` is `insufficient_evidence` say that no reliable document was found instead of answering.",
      inputSchema: {
        query: z
          .string()
          .min(3)
          .describe(
            "The user's question, rewritten as a complete standalone question in the language of the procedure library " +
              "(English for the demo corpus), including equipment names and model numbers.",
          ),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ query }) => {
      const candidates = await retriever.search(query, CANDIDATES);
      if (!candidates.length) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                status: "insufficient_evidence",
                guidance: "No document matched. Tell the user and offer to rephrase or escalate.",
                evidence: [],
                conflicts: [],
              }),
            },
          ],
        };
      }
      const result = await gate(client, query, candidates, { model: process.env.TYPESAFE_MODEL });
      console.log(
        `${new Date().toISOString()} search_procedures "${query}" -> ${result.status} ` +
          `(${result.evidence.length} evidence, ${result.conflicts.length} conflicts, ${result.excluded} excluded, ` +
          `${candidates.length} candidates from ${retriever.name}, gate ${result.ms} ms, ${result.model})`,
      );
      return { content: [{ type: "text", text: JSON.stringify(toToolOutput(result)) }] };
    },
  );

  return server;
}

export function createApp(client: TypeSafeClient, retriever: Retriever) {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  // Optional API key check. In Copilot Studio choose Authentication > API key > Header, name "x-api-key".
  const requiredKey = process.env.MCP_API_KEY;
  const auth = (req: Request, res: Response, next: NextFunction) => {
    if (requiredKey && req.header("x-api-key") !== requiredKey) {
      res.status(401).json({ jsonrpc: "2.0", error: { code: -32001, message: "Unauthorized" }, id: null });
      return;
    }
    next();
  };

  // Stateless Streamable HTTP: a new server and transport per request.
  app.post("/mcp", auth, async (req: Request, res: Response) => {
    const server = createMcpServer(client, retriever);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("Error handling MCP request:", error);
      if (!res.headersSent) {
        res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null });
      }
    }
  });

  const notAllowed = (_req: Request, res: Response) => {
    res.status(405).json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed." }, id: null });
  };
  app.get("/mcp", notAllowed);
  app.delete("/mcp", notAllowed);
  app.get("/healthz", (_req, res) => {
    res.json({ ok: true, retriever: retriever.name });
  });
  return app;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  if (!process.env.TYPESAFE_API_KEY) {
    console.error("Set TYPESAFE_API_KEY (see .env.example).");
    process.exit(1);
  }
  const retriever = createRetriever();
  const port = Number(process.env.PORT ?? 3000);
  createApp(new TypeSafeClient(), retriever).listen(port, () => {
    console.log(`Jev evidence gate MCP server on http://localhost:${port}/mcp (retriever: ${retriever.name})`);
  });
}
