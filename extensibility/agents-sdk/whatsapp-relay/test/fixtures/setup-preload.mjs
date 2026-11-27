import childProcess from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
import { fileURLToPath } from "node:url";

const service = new URL(process.env.RELAY_TEST_SERVICE);
if (service.hostname !== "127.0.0.1") throw new Error("Setup fixtures require a loopback service.");
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(input);
  if (url.origin === service.origin || url.origin === `http://127.0.0.1:${process.env.RELAY_TEST_PORT}`) {
    return originalFetch(input, init);
  }
  if (url.hostname === "alias-3978.uks1.devtunnels.ms") {
    return originalFetch(`http://127.0.0.1:${process.env.RELAY_TEST_PORT}${url.pathname}${url.search}`, init);
  }
  if (!["management.azure.com", "graph.microsoft.com", "graph.facebook.com", "test-relay.azurewebsites.net"].includes(url.hostname)) {
    throw new Error("Unmocked network access is forbidden in setup tests.");
  }
  const reply = await originalFetch(new URL("/fetch", service), {
    method: "POST", headers: { "Content-Type": "application/json" }, signal: init.signal,
    body: JSON.stringify({ url: url.href, method: init.method ?? "GET", body: init.body ? JSON.parse(init.body) : undefined }),
  });
  const result = await reply.json();
  if (result.transportFailure) throw new Error("Simulated lost response");
  return new Response(result.text ?? JSON.stringify(result.body), { status: result.status ?? 200 });
};

const originalSpawn = childProcess.spawn;
childProcess.spawn = function (command, args, options) {
  if (command === "az" || command === "devtunnel") {
    return originalSpawn(process.execPath, [fileURLToPath(new URL("./setup-cli.mjs", import.meta.url)), command, ...args], options);
  }
  return originalSpawn(command, args, options);
};
syncBuiltinESMExports();
