import express, { Request, Response } from "express";

const PORT = parseInt(process.env.PORT || "3000");
const MCP_SERVER_BASE = process.env.MCP_SERVER_BASE || "http://localhost:3001";

const instances = [
  {
    id: "contoso",
    name: "Contoso",
    description: "Contoso Ltd — Global ERP transformation programme",
  },
  {
    id: "fabrikam",
    name: "Fabrikam",
    description: "Fabrikam Inc — Supply chain modernisation",
  },
  {
    id: "northwind",
    name: "Northwind",
    description: "Northwind Traders — Finance & HR digital transformation",
  },
];

const app = express();
app.use(express.json());

// GET /instances — returns catalog with MCP endpoint URLs
app.get("/instances", (_req: Request, res: Response) => {
  res.json(
    instances.map((i) => ({
      id: i.id,
      name: i.name,
      description: i.description,
      mcpUrl: `${MCP_SERVER_BASE}/instances/${i.id}/mcp`,
    }))
  );
});

app.listen(PORT, () => {
  console.log(`Catalog server running on http://localhost:${PORT}`);
  console.log(`MCP server base: ${MCP_SERVER_BASE}`);
});
