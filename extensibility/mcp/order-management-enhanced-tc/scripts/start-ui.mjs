#!/usr/bin/env node

/**
 * Cross-platform script to start the Gradio chat UI.
 * Sets up venv and installs dependencies if needed.
 *
 * Usage: node scripts/start-ui.mjs
 */

import { execSync, spawn } from "child_process";
import { existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const chatDir = resolve(__dirname, "..", "chat-ui");
const python = process.platform === "win32" ? "python" : "python3";
const venvDir = resolve(chatDir, ".venv");
const venvBin = process.platform === "win32" ? "Scripts" : "bin";
const venvPython = resolve(venvDir, venvBin, process.platform === "win32" ? "python.exe" : "python");

// Setup venv if needed
if (!existsSync(venvDir)) {
  console.log("Creating Python virtual environment...");
  execSync(`${python} -m venv .venv`, { cwd: chatDir, stdio: "inherit" });
  console.log("Installing dependencies...");
  execSync(`${venvPython} -m pip install -r requirements.txt`, { cwd: chatDir, stdio: "inherit" });
}

// Check for .env
if (!existsSync(resolve(chatDir, ".env"))) {
  console.error("Missing chat-ui/.env — copy .env.sample and fill in your agent details.");
  console.error("See agents/IMPORT.md for the values you need.");
  process.exit(1);
}

console.log("Starting Gradio chat UI...\n");
const app = spawn(venvPython, ["app.py"], { cwd: chatDir, stdio: "inherit" });

app.on("close", (code) => process.exit(code ?? 0));
process.on("SIGINT", () => { app.kill(); process.exit(0); });
process.on("SIGTERM", () => { app.kill(); process.exit(0); });
