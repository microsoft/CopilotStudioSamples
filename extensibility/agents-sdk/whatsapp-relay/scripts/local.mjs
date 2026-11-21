import { createServer } from "node:net";
import { join } from "node:path";
import {
  cli, cliJson, dependencies, isMain, loadEnvironment, npm, options, root,
  runMain, runtimeKeys, SetupError, spawnTool, stateFile, validateRuntime, waitForHealth,
} from "./common.mjs";
import { MetaSetup } from "./meta-setup.mjs";

export async function checkPort(port) {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", () => reject(new SetupError(`Port ${port} is unavailable. Stop the owning service yourself or choose another PORT.`)));
    probe.listen({ host: "127.0.0.1", port, exclusive: true }, resolve);
  });
  await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
}

export function tunnelUrl(text) {
  const match = /Connect via browser:\s*(https:\/\/[^\s]+)(?=\s)/.exec(text);
  if (!match) return undefined;
  const url = new URL(match[1]);
  if (!url.hostname.endsWith(".devtunnels.ms") || url.username || url.password || url.port ||
      url.pathname !== "/" || url.search || url.hash) throw new SetupError("Dev Tunnels returned an unexpected public URL.");
  return url.origin;
}

export async function ensureTunnel(journal, port, command = cliJson) {
  const { state, save } = journal;
  const label = `whatsapp-relay-${state.owner.replaceAll("-", "")}`;
  const list = await command("devtunnel", ["list", "--all-labels", label, "--json"]);
  // CLI 1.0.1516 reports an empty list as this exact warning instead of an array.
  const tunnels = list?.warning === "No tunnels found." && Object.keys(list).length === 1 ? [] : list?.tunnels;
  if (!Array.isArray(tunnels) || tunnels.length > 1) throw new SetupError("Tunnel ownership lookup is ambiguous.");
  let tunnel = tunnels[0];
  if (state.tunnelId && tunnel?.tunnelId !== state.tunnelId) throw new SetupError("The recorded tunnel was removed, relabeled, or belongs to another account. Inspect .setup/local.json before retrying.");
  if (!tunnel) {
    const created = await command("devtunnel", ["create", `wrelay-${state.owner.replaceAll("-", "")}`, "--allow-anonymous", "--labels", label, "--json"]);
    tunnel = created.tunnel;
  }
  if (!tunnel?.tunnelId || !tunnel.labels?.includes(label)) throw new SetupError("Dev Tunnels did not confirm ownership.");
  state.tunnelId = tunnel.tunnelId;
  await save();
  const detailed = (await command("devtunnel", ["show", tunnel.tunnelId, "--json"])).tunnel;
  if (detailed?.tunnelId !== tunnel.tunnelId || !detailed.labels?.includes(label)) {
    throw new SetupError("Tunnel ownership changed while preparing the port; it was not hosted.");
  }
  const ports = detailed.ports ?? [];
  if (!Array.isArray(ports) || ports.some(p => p.portNumber !== port)) {
    throw new SetupError("This tunnel exposes unexpected ports. Inspect it rather than exposing other local services.");
  }
  if (!ports.length) await command("devtunnel", ["port", "create", tunnel.tunnelId, "-p", String(port), "--protocol", "http", "--json"]);
  else if (!["http", "auto"].includes(ports[0].protocol)) throw new SetupError("The existing tunnel port is not HTTP.");
  return tunnel.tunnelId;
}

export function trackChild(child, name, controller, graceMs = 30_000) {
  let closed = false, stopping = false;
  const done = new Promise(resolve => {
    child.once("error", () => {
      closed = true;
      if (!stopping) controller.abort(new SetupError(`${name} could not start. Check the installed CLI/runtime.`));
      resolve();
    });
    child.once("close", () => {
      closed = true;
      if (!stopping) controller.abort(new SetupError(`${name} exited; the other owned process is being stopped.`));
      resolve();
    });
  });
  return async () => {
    stopping = true;
    if (closed) return;
    child.kill("SIGTERM");
    const timer = setTimeout(() => child.kill("SIGKILL"), graceMs);
    try { await done; } finally { clearTimeout(timer); }
  };
}

export function waitForTunnel(child, signal, timeoutMs = 60_000) {
  return new Promise((resolve, reject) => {
    let output = "";
    const cleanup = () => { clearTimeout(timer); child.stdout.off("data", data); signal.removeEventListener("abort", aborted); };
    const fail = error => { cleanup(); reject(error); };
    const data = chunk => {
      output = (output + chunk.toString()).slice(-16_384);
      try {
        const url = tunnelUrl(output);
        if (url) { cleanup(); resolve(url); }
      } catch (error) { fail(error); }
    };
    const aborted = () => fail(signal.reason);
    const timer = setTimeout(() => fail(new SetupError("Dev Tunnel did not report its public URL. Check login/network access and CLI compatibility.")), timeoutMs);
    child.stdout.on("data", data);
    signal.addEventListener("abort", aborted, { once: true });
    if (signal.aborted) aborted();
  });
}

export async function runServices({ env, config, tunnelId, meta, replace, launch = spawnTool, health = waitForHealth, signals = process }) {
  const controller = new AbortController();
  const requestedStop = new SetupError("Local runner stopped.");
  const stop = () => controller.abort(requestedStop);
  const cleanup = [];
  signals.on("SIGINT", stop);
  signals.on("SIGTERM", stop);
  try {
    const relay = await launch(process.execPath, [join(root, "dist/src/index.js")], {
      env: { ...process.env, ...Object.fromEntries(runtimeKeys.map(key => [key, env[key] ?? ""])),
        PORT: String(config.port), RELAY_HOST: "127.0.0.1", DEBUG: "", NODE_DEBUG: "" },
      stdio: ["ignore", "inherit", "inherit"],
    });
    cleanup.push(trackChild(relay, "Relay", controller));
    await health(`http://127.0.0.1:${config.port}/health`, { signal: controller.signal });
    controller.signal.throwIfAborted();
    const host = await launch("devtunnel", ["host", tunnelId], { stdio: ["ignore", "pipe", "pipe"] });
    cleanup.push(trackChild(host, "Dev Tunnel", controller, 5000));
    // Do not print unfiltered CLI diagnostics, inspection URLs, or token-bearing URLs.
    host.stderr.resume();
    const publicUrl = await waitForTunnel(host, controller.signal);
    await health(`${publicUrl}/health`, { signal: controller.signal });
    controller.signal.throwIfAborted();
    await meta.configure(`${publicUrl}/webhook`, { replace, signal: controller.signal });
    controller.signal.throwIfAborted();
    console.log(`Local relay is ready at ${publicUrl}/webhook. Keep this command running; Ctrl+C stops only its children.`);
    if (!controller.signal.aborted) await new Promise(resolve => controller.signal.addEventListener("abort", resolve, { once: true }));
    controller.signal.throwIfAborted();
  } catch (error) {
    if (error !== requestedStop) throw error;
  } finally {
    try {
      await Promise.all(cleanup.map(stopChild => stopChild()));
    } finally {
      signals.off("SIGINT", stop);
      signals.off("SIGTERM", stop);
    }
  }
}

export async function main() {
  const args = options();
  if (args.help) {
    console.log("npm run start:local -- [--env-file PATH] [--dry-run] [--replace-webhook]\nBuilds the relay, hosts an owned persistent Dev Tunnel, and verifies/configures Meta. A different existing callback requires confirmation.");
    return;
  }
  if (args["dry-run"]) {
    console.log("Dry run: build -> validate private configuration/Meta token -> check port -> own/reuse Dev Tunnel -> local/public health -> confirmed Meta setup. No configuration, credentials, login, network access, or processes were checked or changed.");
    return;
  }
  await dependencies();
  await cli("devtunnel", ["--version"]);
  await npm(["run", "build"]);
  const env = await loadEnvironment(args["env-file"]);
  const config = await validateRuntime(env);
  if (config.host !== "127.0.0.1") throw new SetupError("Use RELAY_HOST=127.0.0.1 for the local runner.");
  await checkPort(config.port);
  const meta = new MetaSetup(env);
  await meta.validate();
  try { await cliJson("devtunnel", ["user", "show", "--json"]); } catch (error) {
    if (!process.stdin.isTTY) throw new SetupError("Dev Tunnel login is unavailable. Run devtunnel user login --entra --use-browser-auth interactively first.");
    console.log("Dev Tunnel login could not be verified. Opening interactive Microsoft sign-in.");
    await cli("devtunnel", ["user", "login", "--entra", "--use-browser-auth"], { interactive: true, timeoutMs: 300_000 });
  }
  const journal = await stateFile("local", { port: config.port });
  try {
    const tunnelId = await ensureTunnel(journal, config.port);
    await runServices({ env, config, tunnelId, meta, replace: args["replace-webhook"] });
  } finally { await journal.release(); }
}
if (isMain(import.meta.url)) await runMain(main);
