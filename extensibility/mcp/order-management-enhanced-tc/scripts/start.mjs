#!/usr/bin/env node

/**
 * Cross-platform script to start both MCP servers + devtunnels.
 * Prints tunnel URLs to update in Copilot Studio MCP actions.
 *
 * Usage: node scripts/start.mjs
 */

import { spawn } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const servers = [
  { name: "Order Management", dir: "mcp-servers/order-management", port: 3000, tunnelUrl: null },
  { name: "Warehouse", dir: "mcp-servers/warehouse", port: 3001, tunnelUrl: null },
];

const children = [];

function startServer(server) {
  const cwd = resolve(ROOT, server.dir);
  const proc = spawn("node", ["dist/start.js"], {
    cwd,
    env: { ...process.env, PORT: String(server.port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  proc.stdout.on("data", (d) => process.stdout.write(`[${server.name}] ${d}`));
  proc.stderr.on("data", (d) => process.stderr.write(`[${server.name}] ${d}`));
  children.push(proc);
}

function startTunnel(server) {
  const proc = spawn("devtunnel", ["host", "-p", String(server.port), "-a"], {
    stdio: ["ignore", "pipe", "pipe"],
  });

  proc.stdout.on("data", (data) => {
    const text = data.toString();
    if (text.includes("Connect via browser")) {
      const urls = text.match(/https:\/\/[^\s,]+/g);
      if (urls) {
        const clean = urls.find((u) => u.includes(`-${server.port}.`)) ?? urls[0];
        server.tunnelUrl = clean.replace(/\/$/, "");
        console.log(`\n  ${server.name} MCP endpoint: ${server.tunnelUrl}/mcp\n`);
        if (servers.every((s) => s.tunnelUrl)) {
          console.log("All tunnels ready. Update these URLs in Copilot Studio:\n");
          for (const s of servers) {
            console.log(`  ${s.name}: ${s.tunnelUrl}/mcp`);
          }
          console.log("\nPress Ctrl+C to stop all servers.\n");
        }
      }
    }
  });
  proc.stderr.on("data", (d) => process.stderr.write(d));
  children.push(proc);
}

function cleanup() {
  for (const child of children) {
    try { child.kill(); } catch {}
  }
  process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

console.log("Starting MCP servers and devtunnels...\n");

for (const server of servers) {
  startServer(server);
  startTunnel(server);
}
