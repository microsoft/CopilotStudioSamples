import express, { Request, Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { stock } from "./data/stock.js";
import { fulfillment } from "./data/fulfillment.js";
import { restockSchedule } from "./data/restock.js";

// ---------------------------------------------------------------------------
// MCP Server — 4 interdependent tools for warehouse & fulfillment
// ---------------------------------------------------------------------------

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "warehouse-fulfillment",
    version: "1.0.0",
  });

  // 1. check_stock — look up inventory for a SKU
  server.tool(
    "check_stock",
    "Check warehouse inventory for a product by SKU. Returns quantity on hand, warehouse location, " +
      "aisle, and whether the item is available for shipping. If quantity is 0, use get_restock_date for restock info.",
    {
      sku: z.string().describe("Product SKU (e.g. 'SKU-WH1000'). Use SKUs from order line items."),
    },
    async ({ sku }) => {
      const entry = stock.find((s) => s.sku === sku);
      if (!entry) {
        return {
          content: [{ type: "text", text: `SKU "${sku}" not found in warehouse inventory.` }],
          isError: true,
        };
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            sku: entry.sku,
            name: entry.name,
            category: entry.category,
            quantity_on_hand: entry.quantity,
            warehouse: entry.warehouse,
            aisle: entry.aisle,
            available_for_shipping: entry.availableForShipping,
            status: entry.quantity === 0 ? "OUT_OF_STOCK" : entry.quantity <= 3 ? "LOW_STOCK" : "IN_STOCK",
          }, null, 2),
        }],
      };
    }
  );

  // 2. get_fulfillment_status — where is an order in the warehouse pipeline
  server.tool(
    "get_fulfillment_status",
    "Get the fulfillment pipeline status for an order. Shows which warehouse stage the order is at " +
      "(received → picked → packed → labeled → handed_to_carrier), assigned worker, and estimated ship date. " +
      "Use an order_id from the order management system.",
    {
      order_id: z.string().describe("Order ID (e.g. 'ORD-10422') from the order management system"),
    },
    async ({ order_id }) => {
      const record = fulfillment.find((f) => f.orderId === order_id);
      if (!record) {
        return {
          content: [{
            type: "text",
            text: `No fulfillment record found for order "${order_id}". The order may not have entered the warehouse yet.`,
          }],
          isError: true,
        };
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            order_id: record.orderId,
            warehouse: record.warehouse,
            assigned_worker: record.assignedWorker,
            current_stage: record.currentStage,
            estimated_ship_date: record.estimatedShipDate,
            notes: record.notes,
            pipeline: record.pipeline.map((s) => ({
              stage: s.stage,
              completed_at: s.timestamp,
            })),
          }, null, 2),
        }],
      };
    }
  );

  // 3. find_alternatives — similar products in same category
  server.tool(
    "find_alternatives",
    "Find alternative products similar to a given SKU. Returns items in the same category that are in stock. " +
      "Useful when a customer wants a different size, color, or comparable product, or when an item is out of stock.",
    {
      sku: z.string().describe("Product SKU to find alternatives for (e.g. 'SKU-HOODIE')"),
    },
    async ({ sku }) => {
      const original = stock.find((s) => s.sku === sku);
      if (!original) {
        return {
          content: [{ type: "text", text: `SKU "${sku}" not found in inventory.` }],
          isError: true,
        };
      }

      // Find items in same category, excluding the original, that are in stock
      const alternatives = stock.filter(
        (s) => s.category === original.category && s.sku !== sku && s.quantity > 0
      );

      if (alternatives.length === 0) {
        return {
          content: [{
            type: "text",
            text: `No alternatives found for "${original.name}" in the ${original.category} category.`,
          }],
        };
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            original: { sku: original.sku, name: original.name, category: original.category },
            alternatives: alternatives.map((a) => ({
              sku: a.sku,
              name: a.name,
              quantity_available: a.quantity,
              warehouse: a.warehouse,
              available_for_shipping: a.availableForShipping,
            })),
          }, null, 2),
        }],
      };
    }
  );

  // 4. get_restock_date — when will an item be back in stock
  server.tool(
    "get_restock_date",
    "Get the next restock date and supplier info for a product. Use this when check_stock shows an item " +
      "is out of stock or low stock. Returns expected delivery date, quantity, and supplier details.",
    {
      sku: z.string().describe("Product SKU (e.g. 'SKU-KINDLE'). Typically used after check_stock shows low/no stock."),
    },
    async ({ sku }) => {
      const info = restockSchedule.find((r) => r.sku === sku);
      if (!info) {
        return {
          content: [{
            type: "text",
            text: `No restock schedule found for SKU "${sku}". The item may be regularly stocked or discontinued.`,
          }],
        };
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            sku: info.sku,
            name: info.name,
            current_quantity: info.currentQuantity,
            next_shipment_date: info.nextShipmentDate,
            expected_quantity: info.expectedQuantity,
            supplier: info.supplier,
            notes: info.notes,
          }, null, 2),
        }],
      };
    }
  );

  return server;
}

// ---------------------------------------------------------------------------
// Express app — stateless Streamable HTTP transport
// ---------------------------------------------------------------------------

export function createServer(port: number): void {
  const app = express();

  app.use((_req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "*");
    if (_req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.use(express.json());

  app.post("/mcp", async (req: Request, res: Response) => {
    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    await server.connect(transport);

    try {
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("Error handling MCP request:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  app.get("/mcp", (_req: Request, res: Response) => {
    res.writeHead(405).end(JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed." },
      id: null,
    }));
  });

  app.delete("/mcp", (_req: Request, res: Response) => {
    res.writeHead(405).end(JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed." },
      id: null,
    }));
  });

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", name: "warehouse-mcp", version: "1.0.0" });
  });

  app.listen(port, () => {
    console.log(`Warehouse MCP Server running on http://localhost:${port}/mcp`);
    console.log(`Health check: http://localhost:${port}/health`);
  });
}
