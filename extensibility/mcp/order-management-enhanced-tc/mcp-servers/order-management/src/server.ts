import express, { Request, Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { orders } from "./data/orders.js";
import { shipments } from "./data/shipments.js";
import { returns, createReturn } from "./data/returns.js";

// ---------------------------------------------------------------------------
// MCP Server — 5 interdependent tools for order management
// ---------------------------------------------------------------------------

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "order-management",
    version: "1.0.0",
  });

  // 1. search_orders — entry point: find orders by customer name, email, or order number
  server.tool(
    "search_orders",
    "Search for orders by customer name, email address, or order number. " +
      "Returns a summary list. Use the order_id from results with get_order for full details.",
    {
      query: z.string().describe(
        "Search term: customer name (e.g. 'Sarah'), email (e.g. 'sarah.mitchell@example.com'), " +
          "or order number (e.g. 'ORD-10421')"
      ),
    },
    async ({ query }) => {
      const q = query.toLowerCase();
      const matches = orders.filter(
        (o) =>
          o.id.toLowerCase().includes(q) ||
          o.customer.name.toLowerCase().includes(q) ||
          o.customer.email.toLowerCase().includes(q)
      );

      if (matches.length === 0) {
        return {
          content: [{ type: "text", text: `No orders found matching "${query}".` }],
        };
      }

      const summaries = matches.map((o) => ({
        order_id: o.id,
        date: o.date,
        status: o.status,
        total: `$${o.total.toFixed(2)}`,
        customer: o.customer.name,
        item_count: o.items.length,
      }));

      return {
        content: [{
          type: "text",
          text: JSON.stringify(summaries, null, 2),
        }],
      };
    }
  );

  // 2. get_order — drill into full order details
  server.tool(
    "get_order",
    "Get full details for a specific order including line items, shipping address, and payment info. " +
      "Use an order_id returned by search_orders.",
    {
      order_id: z.string().describe("Order ID (e.g. 'ORD-10421') from search_orders results"),
    },
    async ({ order_id }) => {
      const order = orders.find((o) => o.id === order_id);
      if (!order) {
        return {
          content: [{ type: "text", text: `Order "${order_id}" not found.` }],
          isError: true,
        };
      }

      const detail = {
        order_id: order.id,
        date: order.date,
        status: order.status,
        customer: order.customer,
        items: order.items.map((i) => ({
          sku: i.sku,
          name: i.name,
          quantity: i.quantity,
          unit_price: `$${i.unitPrice.toFixed(2)}`,
          subtotal: `$${(i.unitPrice * i.quantity).toFixed(2)}`,
        })),
        shipping_address: order.shippingAddress,
        payment_method: order.paymentMethod,
        total: `$${order.total.toFixed(2)}`,
      };

      return {
        content: [{ type: "text", text: JSON.stringify(detail, null, 2) }],
      };
    }
  );

  // 3. get_shipment — tracking info for shipped/delivered orders
  server.tool(
    "get_shipment",
    "Get shipment tracking details for an order. Only works for orders with status 'shipped' or 'delivered'. " +
      "Use an order_id from get_order. Returns carrier, tracking number, URL, and event timeline.",
    {
      order_id: z.string().describe("Order ID (e.g. 'ORD-10421') — must be a shipped or delivered order"),
    },
    async ({ order_id }) => {
      const order = orders.find((o) => o.id === order_id);
      if (!order) {
        return {
          content: [{ type: "text", text: `Order "${order_id}" not found.` }],
          isError: true,
        };
      }

      if (order.status !== "shipped" && order.status !== "delivered") {
        return {
          content: [{
            type: "text",
            text: `Order "${order_id}" has status "${order.status}" — shipment tracking is only available for shipped or delivered orders.`,
          }],
          isError: true,
        };
      }

      const shipment = shipments.find((s) => s.orderId === order_id);
      if (!shipment) {
        return {
          content: [{ type: "text", text: `No shipment record found for order "${order_id}".` }],
          isError: true,
        };
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            order_id: shipment.orderId,
            carrier: shipment.carrier,
            tracking_number: shipment.trackingNumber,
            tracking_url: shipment.trackingUrl,
            estimated_delivery: shipment.estimatedDelivery,
            latest_status: shipment.events[0]?.status ?? "Unknown",
            events: shipment.events,
          }, null, 2),
        }],
      };
    }
  );

  // 4. request_return — initiate a return for specific items
  server.tool(
    "request_return",
    "Initiate a return for specific items in an order. Requires order_id from get_order and the SKU(s) " +
      "of items to return (found in get_order results). Returns a return authorization with label and instructions.",
    {
      order_id: z.string().describe("Order ID (e.g. 'ORD-10421')"),
      item_skus: z.array(z.string()).describe(
        "Array of item SKUs to return (e.g. ['SKU-WH1000']). Get SKUs from get_order results."
      ),
      reason: z.string().describe("Reason for return (e.g. 'defective', 'wrong size', 'changed mind')"),
    },
    async ({ order_id, item_skus, reason }) => {
      const order = orders.find((o) => o.id === order_id);
      if (!order) {
        return {
          content: [{ type: "text", text: `Order "${order_id}" not found.` }],
          isError: true,
        };
      }

      if (order.status === "cancelled") {
        return {
          content: [{ type: "text", text: `Order "${order_id}" is cancelled and cannot be returned.` }],
          isError: true,
        };
      }

      if (order.status === "processing") {
        return {
          content: [{
            type: "text",
            text: `Order "${order_id}" is still processing. Please wait until it ships or cancel the order instead.`,
          }],
          isError: true,
        };
      }

      const matchedItems = order.items.filter((i) => item_skus.includes(i.sku));
      const unknownSkus = item_skus.filter((sku) => !order.items.some((i) => i.sku === sku));

      if (matchedItems.length === 0) {
        return {
          content: [{
            type: "text",
            text: `None of the provided SKUs (${item_skus.join(", ")}) match items in order "${order_id}". ` +
              `Available SKUs: ${order.items.map((i) => i.sku).join(", ")}`,
          }],
          isError: true,
        };
      }

      const refundAmount = matchedItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
      const ret = createReturn(order_id, item_skus, reason, refundAmount, order.paymentMethod);

      const response: Record<string, unknown> = {
        return_id: ret.id,
        order_id: ret.orderId,
        status: ret.status,
        items_returned: matchedItems.map((i) => ({ sku: i.sku, name: i.name })),
        reason: ret.reason,
        estimated_refund: `$${ret.refundAmount.toFixed(2)}`,
        refund_to: order.paymentMethod,
        return_label_url: ret.returnLabelUrl,
        instructions: "Print the return label and attach it to the package. Drop off at any carrier location within 14 days.",
      };

      if (unknownSkus.length > 0) {
        response.warnings = [`These SKUs were not found in the order and were skipped: ${unknownSkus.join(", ")}`];
      }

      return {
        content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
      };
    }
  );

  // 5. get_return_status — check status of a return request
  server.tool(
    "get_return_status",
    "Check the status of a return request. Use the return_id (RA number) from request_return results " +
      "or ask the customer for their RA number. Returns status, timeline, and refund details.",
    {
      return_id: z.string().describe("Return authorization ID (e.g. 'RA-50012') from request_return results"),
    },
    async ({ return_id }) => {
      const ret = returns.find((r) => r.id === return_id);
      if (!ret) {
        return {
          content: [{ type: "text", text: `Return "${return_id}" not found.` }],
          isError: true,
        };
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            return_id: ret.id,
            order_id: ret.orderId,
            status: ret.status,
            items: ret.itemSkus,
            reason: ret.reason,
            refund_amount: `$${ret.refundAmount.toFixed(2)}`,
            return_label_url: ret.returnLabelUrl,
            created: ret.createdAt,
            timeline: ret.timeline,
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

  // POST /mcp — stateless: new server + transport per request
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

  // GET & DELETE /mcp — 405
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
    res.json({ status: "ok", name: "order-management-mcp", version: "1.0.0" });
  });

  app.listen(port, () => {
    console.log(`Order Management MCP Server running on http://localhost:${port}/mcp`);
    console.log(`Health check: http://localhost:${port}/health`);
  });
}
