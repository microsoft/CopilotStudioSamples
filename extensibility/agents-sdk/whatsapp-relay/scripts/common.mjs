import { spawn as nodeSpawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { realpathSync } from "node:fs";
import { chmod, lstat, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs, parseEnv } from "node:util";

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const setupDir = join(root, ".setup");
export const runtimeKeys = [
  "META_GRAPH_VERSION", "META_ACCESS_TOKEN", "META_APP_SECRET", "META_VERIFY_TOKEN",
  "META_PHONE_NUMBER_ID", "META_WABA_ID", "BOT_CLIENT_ID", "BOT_TENANT_ID",
  "BOT_CLIENT_SECRET", "BOT_OAUTH_CONNECTION", "GHCP_DIRECT_CONNECT_URL", "GHCP_CLOUD", "GHCP_FILE_ORIGINS",
];

export class SetupError extends Error {}
export class ApiError extends SetupError {
  constructor(service, status, code) {
    const safeCode = /^[A-Za-z0-9_.-]{1,80}$/.test(String(code)) ? ` (${code})` : "";
    super(`${service} returned HTTP ${status}${safeCode}. Check credentials, permissions, and target configuration.`);
    this.status = status;
    this.code = code;
  }
}

export function options(extra = {}) {
  return parseArgs({ options: {
    help: { type: "boolean" }, "dry-run": { type: "boolean" },
    "env-file": { type: "string", default: join(root, ".env") },
    "replace-webhook": { type: "boolean" }, ...extra,
  }, strict: true, allowPositionals: false }).values;
}

export function required(value, name, pattern) {
  if (typeof value !== "string" || !value.trim() || (pattern && !pattern.test(value))) {
    throw new SetupError(`Provide a valid ${name}.`);
  }
  return value.trim();
}
export const guid = (value, name) => required(value, name, /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i);
export const resourceName = (value, name) => required(value, name, /^[a-zA-Z0-9][a-zA-Z0-9_-]{1,58}[a-zA-Z0-9]$/);

export async function privateWrite(path, content) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temp = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temp, content, { mode: 0o600, flag: "wx" });
    await rename(temp, path);
    await chmod(path, 0o600);
  } finally {
    await rm(temp, { force: true });
  }
}

export async function loadEnvironment(path, environment = process.env) {
  let saved = {};
  try { saved = parseEnv(await readFile(path, "utf8")); } catch (error) {
    if (error.code !== "ENOENT") throw new SetupError("Cannot read the environment file.");
  }
  return { ...saved, ...environment };
}

export async function updateEnvironment(path, values) {
  let source;
  try { source = await readFile(path, "utf8"); } catch (error) {
    if (error.code !== "ENOENT") throw error;
    source = await readFile(join(root, ".env.example"), "utf8");
  }
  // Replacing multiline dotenv values with a line regex could expose part of a secret.
  const existing = parseEnv(source);
  if (Object.values(existing).some(value => /[\r\n]/.test(value))) {
    throw new SetupError("Automatic environment updates require single-line values; the file was not changed.");
  }
  for (const [key, value] of Object.entries(values)) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(key) || typeof value !== "string" ||
        /[\r\n"]/.test(value) || /[\r\n]/.test(existing[key] ?? "")) {
      throw new SetupError("Setup values must be single-line strings without double quotes.");
    }
    const line = `${key}="${value}"`;
    const pattern = new RegExp(`^[\\t ]*(?:export[\\t ]+)?${key}[\\t ]*=.*$`, "gm");
    let found = false;
    source = source.replace(pattern, () => {
      if (found) return "";
      found = true;
      return line;
    });
    if (!found) source = `${source.trimEnd()}\n${line}\n`;
  }
  await privateWrite(path, source);
}

export async function stateFile(name, target, { directory = setupDir } = {}) {
  const path = join(directory, `${name}.json`);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const lock = `${path}.lock`;
  const nonce = randomUUID();
  try { await writeFile(lock, JSON.stringify({ pid: process.pid, nonce }), { flag: "wx", mode: 0o600 }); } catch (error) {
    if (error.code === "EEXIST") throw new SetupError(`Setup ${name} is locked. Check the recorded process; remove only the stale .setup/${name}.json.lock if it is no longer running.`);
    throw error;
  }
  const release = async () => {
    if (JSON.parse(await readFile(lock, "utf8")).nonce !== nonce) throw new SetupError("Setup lock ownership changed; it was not removed.");
    await rm(lock);
  };
  try {
    let state;
    try {
      state = JSON.parse(await readFile(path, "utf8"));
      guid(state?.owner, "setup ownership identifier");
    } catch (error) {
      if (error.code !== "ENOENT") throw new SetupError(`Cannot read .setup/${name}.json; do not discard ownership records blindly.`);
    }
    if (state && JSON.stringify(state.target) !== JSON.stringify(target)) {
      throw new SetupError(`.setup/${name}.json belongs to another target. Use a separate checkout/configuration.`);
    }
    state ??= { target, owner: randomUUID() };
    const save = () => privateWrite(path, `${JSON.stringify(state, null, 2)}\n`);
    await save();
    return { state, save, release };
  } catch (error) { await release(); throw error; }
}

export async function confirm(message, { approved = false, input = process.stdin, output = process.stdout, signal } = {}) {
  signal?.throwIfAborted();
  if (approved) return;
  if (!input.isTTY) throw new SetupError(`${message} Explicit confirmation is required in noninteractive runs.`);
  const reader = createInterface({ input, output });
  const interrupted = new AbortController();
  const cancellation = AbortSignal.any([interrupted.signal, ...(signal ? [signal] : [])]);
  reader.once("SIGINT", () => interrupted.abort(new SetupError("Cancelled; existing configuration was not replaced.")));
  try {
    if ((await reader.question(`${message} [y/N] `, { signal: cancellation })).trim().toLowerCase() !== "y") {
      throw new SetupError("Cancelled; existing configuration was not replaced.");
    }
  } catch (error) {
    if (cancellation.aborted) throw cancellation.reason;
    throw error;
  } finally { reader.close(); }
}

export async function spawnTool(executable, args, opts = {}) {
  const { default: spawn } = await import("cross-spawn");
  return spawn(executable, args, {
    cwd: root, env: { ...process.env, DEBUG: "", NODE_DEBUG: "" },
    stdio: "pipe", ...opts, shell: false,
  });
}

export function capture(child, label, timeoutMs = 120_000) {
  return new Promise((resolvePromise, reject) => {
    let output = "", size = 0, failure, killTimer;
    const terminate = message => {
      if (failure) return;
      failure = new SetupError(message);
      child.kill("SIGTERM");
      killTimer = setTimeout(() => child.kill("SIGKILL"), 2000);
    };
    const timer = setTimeout(() => terminate(`${label} timed out. Check the operation before retrying.`), timeoutMs);
    child.stdout?.on("data", chunk => {
      size += chunk.length;
      if (size > 4 * 1024 * 1024) {
        terminate(`${label} returned too much output.`);
      } else output += chunk.toString();
    });
    child.stderr?.resume();
    child.once("error", () => { clearTimeout(timer); clearTimeout(killTimer); reject(new SetupError(`${label} could not start. Check that its CLI is installed.`)); });
    child.once("close", code => {
      clearTimeout(timer);
      clearTimeout(killTimer);
      if (failure) reject(failure);
      else if (code !== 0) reject(new SetupError(`${label} failed (exit ${code}). Check login, permissions, and arguments; raw CLI output is suppressed to protect credentials.`));
      else resolvePromise(output);
    });
  });
}

export async function cli(executable, args, { interactive = false, timeoutMs } = {}) {
  const child = await spawnTool(executable, args, { stdio: interactive ? "inherit" : "pipe" });
  return capture(child, executable, timeoutMs);
}
export async function cliJson(executable, args, opts) {
  const output = await cli(executable, args, opts);
  try { return JSON.parse(output); } catch { throw new SetupError(`${executable} did not return valid JSON.`); }
}

export async function npm(args) {
  // npm supplies its JS entrypoint to scripts, avoiding shell quoting on Windows.
  const executable = process.env.npm_execpath;
  if (!executable) throw new SetupError("Run this command through its documented npm run script.");
  return capture(nodeSpawn(process.execPath, [executable, ...args], {
    cwd: root, env: { ...process.env, DEBUG: "", NODE_DEBUG: "" }, stdio: "pipe",
  }), "npm", 300_000);
}
export async function dependencies() {
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (!((major === 22 && minor >= 17) || major === 24)) throw new SetupError("Use Node.js 22.17+ (22.x) or 24.x.");
  try {
    await lstat(join(root, "node_modules", "cross-spawn", "package.json"));
    await lstat(join(root, "node_modules", "fflate", "package.json"));
    await lstat(join(root, "node_modules", "typescript", "package.json"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    console.log("Installing project dependencies from the lockfile.");
    await npm(["ci", "--no-audit", "--no-fund"]);
  }
}

export async function validateRuntime(env) {
  const { loadConfig } = await import(pathToFileURL(join(root, "dist/src/config.js")));
  try { return loadConfig(env); } catch {
    throw new SetupError("Runtime configuration is incomplete or invalid. Check .env against .env.example; no configuration values were logged.");
  }
}

export async function requestJson(url, token, { method = "GET", body, service = "API", fetcher = fetch, signal } = {}) {
  const response = await fetcher(url, {
    method, redirect: "error", signal: AbortSignal.any([AbortSignal.timeout(60_000), ...(signal ? [signal] : [])]),
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  let data;
  if (response.status !== 204) {
    const reader = response.body?.getReader();
    const chunks = [];
    let size = 0;
    try {
      if (reader) for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.length;
        if (size > 1024 * 1024) throw new SetupError(`${service} returned an oversized response.`);
        chunks.push(Buffer.from(chunk.value));
      }
    } finally { if (reader) { await reader.cancel(); reader.releaseLock(); } }
    try { data = JSON.parse(Buffer.concat(chunks).toString()); } catch {
      if (response.ok) throw new SetupError(`${service} returned invalid JSON.`);
    }
  }
  if (!response.ok || data?.error) throw new ApiError(service, response.status, data?.error?.code);
  return data;
}

export async function boundedText(response, limit = 1024) {
  const reader = response.body?.getReader();
  let text = "", size = 0;
  try {
    if (reader) for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new SetupError("The verification endpoint returned too much data.");
      text += Buffer.from(value).toString("utf8");
    }
  } finally { if (reader) { await reader.cancel(); reader.releaseLock(); } }
  return text;
}

export async function waitForHealth(url, { signal, attempts = 60, fetcher = fetch, delay = ms => new Promise(r => setTimeout(r, ms)) } = {}) {
  for (let i = 0; i < attempts; i++) {
    signal?.throwIfAborted();
    try {
      const response = await fetcher(url, { redirect: "error", signal: AbortSignal.any([
        AbortSignal.timeout(3000), ...(signal ? [signal] : []),
      ]) });
      const body = await boundedText(response, 32);
      if (response.ok && body === "ok") return;
    } catch (error) { if (signal?.aborted) throw signal.reason; }
    if (i + 1 < attempts) await delay(1000);
  }
  throw new SetupError("The host did not become healthy. Check startup/tunnel status; the webhook was not switched.");
}

export function isMain(url) {
  if (!process.argv[1]) return false;
  try { return url === pathToFileURL(realpathSync(process.argv[1])).href; } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") return false;
    throw error;
  }
}
export async function runMain(main) {
  try { await main(); } catch (error) {
    console.error(error instanceof SetupError ? error.message : "Setup failed unexpectedly. Check prerequisites and configuration; private error details were suppressed.");
    process.exitCode = 1;
  }
}
