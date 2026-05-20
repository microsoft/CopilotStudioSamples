#!/usr/bin/env node
/**
 * setup.js — Starts the HITL backend and creates a public tunnel.
 *
 * After running this script, import solution/customHIL_1_0_0_3.zip into
 * your Power Platform environment and set the HitlHostUrl environment
 * variable to the tunnel host URL printed below.
 *
 * Prerequisites:
 *   - Node.js 18+
 *   - devtunnel CLI (https://learn.microsoft.com/azure/developer/dev-tunnels/get-started)
 *
 * Usage:
 *   node setup.js
 */

const { execSync, spawn } = require("child_process");
const path = require("path");

const PORT = 3978;
const TUNNEL_NAME = "hitl-sample";
const DIR = __dirname;

// ── Helpers ──
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const blue = (s) => `\x1b[34m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;

function step(msg) { console.log(`\n${blue(`▸ ${msg}`)}`); }
function ok(msg) { console.log(green(`  ✓ ${msg}`)); }
function warn(msg) { console.log(yellow(`  ⚠ ${msg}`)); }

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { cwd: DIR, encoding: "utf8", stdio: opts.quiet ? "pipe" : "inherit", ...opts }).trim();
  } catch (err) {
    if (opts.ignoreError) return "";
    throw err;
  }
}

function runQuiet(cmd) {
  return run(cmd, { quiet: true, ignoreError: true, stdio: "pipe" });
}

// ── 1. Install dependencies ──
step("Installing npm dependencies");
run("npm install --silent");
ok("Done");

// ── 2. Create dev tunnel ──
step("Setting up dev tunnel");

// Check devtunnel is installed
try {
  runQuiet("devtunnel --help");
} catch {
  warn("devtunnel CLI not found.");
  console.log("  Install: https://learn.microsoft.com/azure/developer/dev-tunnels/get-started");
  process.exit(1);
}

// Check login
const userShow = runQuiet("devtunnel user show");
if (!userShow || userShow.includes("not logged in")) {
  console.log("  You need to log in to devtunnel first.");
  run("devtunnel user login");
}

// Delete existing tunnel
runQuiet(`devtunnel delete ${TUNNEL_NAME}`);

// Wait a moment for cleanup
execSync(process.platform === "win32" ? "timeout /t 2 /nobreak >nul" : "sleep 2", { stdio: "ignore" });

// Create tunnel
run(`devtunnel create ${TUNNEL_NAME} --allow-anonymous`);
run(`devtunnel port create ${TUNNEL_NAME} --port-number ${PORT} --protocol http`);
ok("Tunnel created");

// Get tunnel URL
let tunnelHost = "";

// Try JSON output
const jsonOutput = runQuiet(`devtunnel show ${TUNNEL_NAME} --json`);
if (jsonOutput) {
  try {
    const data = JSON.parse(jsonOutput);
    const tid = (data.tunnel || data).tunnelId || "";
    const parts = tid.split(".");
    if (parts.length === 2) {
      tunnelHost = `${parts[0]}-${PORT}.${parts[1]}.devtunnels.ms`;
    }
  } catch {}
}

// Fallback: parse text output
if (!tunnelHost) {
  const textOutput = runQuiet(`devtunnel show ${TUNNEL_NAME}`);
  const match = textOutput.match(/Tunnel ID\s*:\s*(\S+)/);
  if (match) {
    const parts = match[1].split(".");
    if (parts.length === 2) {
      tunnelHost = `${parts[0]}-${PORT}.${parts[1]}.devtunnels.ms`;
    }
  }
}

if (!tunnelHost) {
  warn("Could not extract tunnel URL. Run: devtunnel show " + TUNNEL_NAME);
  process.exit(1);
}

const tunnelUrl = `https://${tunnelHost}`;
ok(`Tunnel URL: ${tunnelUrl}`);

// ── 3. Start server ──
step("Starting server");

const server = spawn("node", [path.join(DIR, "server.js")], {
  cwd: DIR,
  stdio: "inherit",
  env: { ...process.env, PORT: String(PORT) },
});

// Give server time to start
execSync(process.platform === "win32" ? "timeout /t 2 /nobreak >nul" : "sleep 2", { stdio: "ignore" });

ok(`Server running (PID ${server.pid})`);

// ── 4. Print instructions and start tunnel ──
console.log(`
${green("════════════════════════════════════════════════════════")}
${green("  HITL backend ready!")}

  Tunnel URL:   ${tunnelUrl}
  Tunnel host:  ${blue(tunnelHost)}

  Next steps:
    1. Import solution/customHIL_1_0_0_3.zip into your environment
    2. When prompted, set HitlHostUrl to:

       ${blue(tunnelHost)}

    3. Create a flow or agent action using the connector

  Starting tunnel (Ctrl+C to stop everything)...
${green("════════════════════════════════════════════════════════")}
`);

// Clean up server when tunnel exits
process.on("SIGINT", () => {
  console.log("\nStopping server...");
  server.kill();
  process.exit(0);
});

process.on("SIGTERM", () => {
  server.kill();
  process.exit(0);
});

// Start tunnel in foreground
const tunnel = spawn("devtunnel", ["host", TUNNEL_NAME], {
  stdio: "inherit",
});

tunnel.on("exit", (code) => {
  server.kill();
  process.exit(code || 0);
});
