#!/usr/bin/env node

/**
 * Cross-platform script to deploy MCP connectors to a Power Platform environment.
 *
 * Usage: node scripts/deploy-connectors.mjs <environment-id> <order-tunnel-url> <warehouse-tunnel-url>
 *
 * Prerequisites:
 *   pip install paconn
 *   paconn login  (or: python3 -m paconn login)
 *
 * Example:
 *   node scripts/deploy-connectors.mjs 6cc0c98e-3fe6-e0d5-8eba-ba51c9da1d13 \
 *     https://abc123-3000.uks1.devtunnels.ms \
 *     https://def456-3001.uks1.devtunnels.ms
 */

import { execSync } from "child_process";
import { readFileSync, writeFileSync, mkdtempSync, cpSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { tmpdir } from "os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const [,, envId, orderUrl, warehouseUrl] = process.argv;

if (!envId || !orderUrl || !warehouseUrl) {
  console.error("Usage: node scripts/deploy-connectors.mjs <env-id> <order-tunnel-url> <warehouse-tunnel-url>");
  console.error("");
  console.error("Example:");
  console.error("  node scripts/deploy-connectors.mjs 6cc0c98e-... https://abc-3000.devtunnels.ms https://def-3001.devtunnels.ms");
  process.exit(1);
}

const paconn = process.platform === "win32" ? "paconn" : "python3 -m paconn";

function deployConnector(name, connectorDir, tunnelUrl) {
  console.log(`\n=== Deploying ${name} connector ===`);

  // Create a temp copy with the tunnel URL patched in
  const tmpDir = mkdtempSync(join(tmpdir(), `connector-${name}-`));
  cpSync(connectorDir, tmpDir, { recursive: true });

  // Patch the swagger host
  const swaggerPath = join(tmpDir, "apiDefinition.swagger.json");
  let swagger = readFileSync(swaggerPath, "utf-8");

  // Extract host from tunnel URL (strip scheme and trailing slash)
  const host = tunnelUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  swagger = swagger.replace("TUNNEL_HOST_PLACEHOLDER", host);
  writeFileSync(swaggerPath, swagger);

  console.log(`  Tunnel URL: ${tunnelUrl}`);
  console.log(`  Swagger host set to: ${host}`);

  try {
    execSync(
      `${paconn} create --api-def "${join(tmpDir, "apiDefinition.swagger.json")}" --api-prop "${join(tmpDir, "apiProperties.json")}" --env "${envId}"`,
      { stdio: "inherit" }
    );
    console.log(`  ${name} connector deployed successfully.`);
  } catch (e) {
    console.error(`  Failed to deploy ${name} connector. You may need to run 'paconn login' first.`);
    console.error(`  Or use 'paconn update' if the connector already exists.`);
  }
}

deployConnector("Order Management", resolve(ROOT, "connectors/order-management"), orderUrl);
deployConnector("Warehouse", resolve(ROOT, "connectors/warehouse"), warehouseUrl);

console.log("\n=== Done ===");
console.log("Next: Import agent solutions in Copilot Studio (see agents/IMPORT.md)");
