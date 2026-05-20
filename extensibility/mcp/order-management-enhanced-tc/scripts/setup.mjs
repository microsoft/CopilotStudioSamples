#!/usr/bin/env node

/**
 * Cross-platform setup script.
 * Installs and builds both MCP servers + Python chat UI dependencies.
 */

import { execSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function run(cmd, cwd) {
  console.log(`\n> ${cmd}  (in ${cwd})`);
  execSync(cmd, { cwd, stdio: "inherit" });
}

console.log("=== Setting up Order Management MCP Server ===");
run("npm install", resolve(ROOT, "mcp-servers/order-management"));
run("npm run build", resolve(ROOT, "mcp-servers/order-management"));

console.log("\n=== Setting up Warehouse MCP Server ===");
run("npm install", resolve(ROOT, "mcp-servers/warehouse"));
run("npm run build", resolve(ROOT, "mcp-servers/warehouse"));

console.log("\n=== Setting up Chat UI ===");
const chatDir = resolve(ROOT, "chat-ui");
const python = process.platform === "win32" ? "python" : "python3";
const venvBin = process.platform === "win32" ? "Scripts" : "bin";
const pip = resolve(chatDir, ".venv", venvBin, "pip");

try {
  run(`${python} -m venv .venv`, chatDir);
  run(`${pip} install -r requirements.txt`, chatDir);
} catch (e) {
  console.error("Python setup failed. Ensure Python 3.12+ is installed.");
  console.error(e.message);
}

console.log("\n=== Setup complete ===");
console.log("Next steps:");
console.log("  1. Start servers:  node scripts/start.mjs");
console.log("  2. Deploy connectors:  node scripts/deploy-connectors.mjs <env-id> <order-url> <warehouse-url>");
console.log("  3. Import agents in Copilot Studio (see agents/IMPORT.md)");
console.log("  4. Start UI:  node scripts/start-ui.mjs");
