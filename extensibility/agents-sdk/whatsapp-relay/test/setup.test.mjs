import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtemp, mkdir, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import test from "node:test";
import { unzipSync } from "fflate";
import {
  ApiError, capture, confirm, loadEnvironment, requestJson, SetupError, stateFile,
  updateEnvironment, waitForHealth,
} from "../scripts/common.mjs";
import { Azure, assertOwned } from "../scripts/azure.mjs";
import { provisionAuth, reuseAuth } from "../scripts/auth.mjs";
import { appSettings, deployInfrastructure, selectRuntime, sourceArchive } from "../scripts/deploy.mjs";
import { checkPort, ensureTunnel, runServices, trackChild, tunnelUrl, waitForTunnel } from "../scripts/local.mjs";
import { MetaSetup } from "../scripts/meta-setup.mjs";

const tenant = "11111111-1111-1111-1111-111111111111";
const subscription = "22222222-2222-2222-2222-222222222222";
const target = { tenant, subscription, group: "relay-test", location: "westeurope" };
const metaEnv = { META_GRAPH_VERSION: "v25.0", META_ACCESS_TOKEN: "private-token", META_APP_SECRET: "private-secret", META_VERIFY_TOKEN: "private-verification", META_PHONE_NUMBER_ID: "12", META_WABA_ID: "34" };
const callback = "https://relay.example/webhook";
const oldCallback = "https://old.example/webhook";

async function temporary(t) {
  const directory = await mkdtemp(join(tmpdir(), "whatsapp-setup-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}
function journal() {
  return { state: { target, owner: "owner" }, save: async () => {} };
}
function child() {
  const value = new EventEmitter();
  value.stdout = new PassThrough();
  value.stderr = new PassThrough();
  value.kills = [];
  value.kill = signal => { value.kills.push(signal); queueMicrotask(() => value.emit("close", null)); return true; };
  return value;
}

test("private environment updates preserve unrelated entries and normalize duplicate/exported keys", async t => {
  const directory = await temporary(t);
  const path = join(directory, ".env");
  await writeFile(path, "# Keep this\nKEEP='unchanged # literal'\n export BOT_CLIENT_SECRET = old\nBOT_CLIENT_SECRET=duplicate\n");
  await updateEnvironment(path, { BOT_CLIENT_SECRET: "new#secret=$value\\literal", BOT_CLIENT_ID: tenant });
  const parsed = await loadEnvironment(path, {});
  assert.equal(parsed.KEEP, "unchanged # literal");
  assert.equal(parsed.BOT_CLIENT_SECRET, "new#secret=$value\\literal");
  const text = await readFile(path, "utf8");
  assert.equal(text.match(/BOT_CLIENT_SECRET=/g).length, 1);
  assert.ok(text.includes("# Keep this"));
  if (process.platform !== "win32") assert.equal((await stat(path)).mode & 0o777, 0o600);
  assert.equal((await loadEnvironment(path, { KEEP: "override" })).KEEP, "override");
});

test("environment updates refuse ambiguous multiline values and quoted new secrets", async t => {
  const path = join(await temporary(t), ".env");
  const original = 'KEEP="first\nBOT_CLIENT_SECRET=inside\nlast"\n';
  await writeFile(path, original);
  await assert.rejects(updateEnvironment(path, { BOT_CLIENT_SECRET: "new" }), /single-line/);
  assert.equal(await readFile(path, "utf8"), original);
  await writeFile(path, "KEEP=x\n");
  await assert.rejects(updateEnvironment(path, { BOT_CLIENT_SECRET: 'bad"value' }), /double quotes/);
});

test("ownership state is locked, stable across reruns, and refuses a different target", async t => {
  const directory = await temporary(t);
  const first = await stateFile("auth", target, { directory });
  await assert.rejects(stateFile("auth", target, { directory }), /locked/);
  await first.release();
  const again = await stateFile("auth", target, { directory });
  assert.equal(again.state.owner, first.state.owner);
  await again.release();
  await assert.rejects(stateFile("auth", { ...target, group: "other" }, { directory }), /another target/);
  const final = await stateFile("auth", target, { directory });
  await final.release();
  await writeFile(join(directory, "auth.json"), JSON.stringify({ target }));
  await assert.rejects(stateFile("auth", target, { directory }), /ownership records/);
});

test("noninteractive destructive replacement needs explicit approval", async () => {
  await assert.rejects(confirm("Replace?", { input: { isTTY: false } }), /confirmation/);
  await confirm("Replace?", { approved: true, input: { isTTY: false } });
});

test("CLI failures suppress secret output and timeouts wait for owned process exit", async () => {
  const failed = child();
  const result = capture(failed, "fake CLI");
  failed.stdout.write("private-token");
  failed.stderr.write("private-secret");
  failed.emit("close", 1);
  await assert.rejects(result, error => !error.message.includes("private-") && /exit 1/.test(error.message));
  const timed = child();
  await assert.rejects(capture(timed, "fake CLI", 5), /timed out/);
  assert.deepEqual(timed.kills, ["SIGTERM"]);
});

test("HTTP setup requests use protected headers/body and sanitized bounded errors", async () => {
  await assert.rejects(requestJson("https://api.example", "private-token", {
    service: "Fake", method: "PUT", body: { secret: "private-value" },
    fetcher: async (url, init) => {
      assert.equal(url, "https://api.example");
      assert.equal(init.headers.Authorization, "Bearer private-token");
      assert.equal(init.redirect, "error");
      assert.equal(JSON.parse(init.body).secret, "private-value");
      return Response.json({ error: { code: "Denied", message: "private-value" } }, { status: 403 });
    },
  }), error => error instanceof ApiError && error.status === 403 && !error.message.includes("private-"));
  await assert.rejects(requestJson("https://api.example", "token", {
    fetcher: async () => new Response("x".repeat(1024 * 1024 + 1)),
  }), /oversized/);
});

test("health requires the exact bounded response and honors cancellation", async () => {
  await waitForHealth("https://relay.example/health", { fetcher: async () => new Response("ok"), attempts: 1 });
  for (const value of ["not ok", "x".repeat(100)]) {
    await assert.rejects(waitForHealth("https://relay.example/health", { fetcher: async () => new Response(value), attempts: 1 }), /healthy/);
  }
  await assert.rejects(waitForHealth("https://relay.example/health", { signal: AbortSignal.abort(new SetupError("stopped")) }), /stopped/);
});

function metaFixture({ existing = true, rejectConfirmation = false, override = false, phoneOverride = false, overrideAfterWrite = false, version = "v25.0", installed = false } = {}) {
  let saved = existing ? { object: "whatsapp_business_account", callback_url: oldCallback, active: true, include_values: true, fields: [{ name: "account_update", version }] } : undefined;
  const calls = [], confirmations = [];
  const api = new MetaSetup(metaEnv, {
    request: async (url, token, options = {}) => {
      const path = new URL(url).pathname;
      calls.push({ path, token, ...options });
      if (path.endsWith("/debug_token")) return { data: { is_valid: true, app_id: "56" } };
      if (path.endsWith("/phone_numbers")) return { data: [{ id: "12" }] };
      if (path.endsWith("/12")) return new URL(url).searchParams.get("fields")?.includes("webhook_configuration")
        ? { id: "12", webhook_configuration: phoneOverride ? { phone_number: oldCallback } : {} } : { id: "12" };
      if (path.endsWith("/subscriptions")) {
        if (options.method === "POST") {
          saved = { ...options.body, active: true, fields: options.body.fields.split(",").map(name => ({ name })) };
          if (overrideAfterWrite) phoneOverride = true;
          return { success: true };
        }
        return { data: [{ object: "page", callback_url: "https://unrelated.example" }, ...(saved ? [saved] : [])] };
      }
      if (path.endsWith("/subscribed_apps")) {
        if (options.method === "POST") { installed = true; return { success: true }; }
        return { data: installed ? [{ whatsapp_business_api_data: { id: "56" }, ...(override ? { override_callback_uri: oldCallback } : {}) }] : [] };
      }
      throw new Error("Unexpected fake Meta route");
    },
    confirmation: async (message, args) => {
      confirmations.push(args);
      if (rejectConfirmation) throw new SetupError("Cancelled");
    },
    fetcher: async url => new Response(url.searchParams.get("hub.challenge")),
  });
  return { api, calls, confirmations };
}

test("Meta verifies app/phone/WABA, confirms replacement, and preserves other fields", async () => {
  const fixture = metaFixture();
  await fixture.api.validate();
  await fixture.api.configure(callback, { replace: true });
  assert.deepEqual(fixture.confirmations, [{ approved: true, signal: undefined }]);
  const writes = fixture.calls.filter(call => call.method === "POST");
  assert.equal(writes.length, 2);
  assert.equal(writes[0].body.fields, "messages,account_update");
  assert.equal(writes[0].body.include_values, true);
  assert.equal(writes[0].body.verify_token, metaEnv.META_VERIFY_TOKEN);
  assert.equal(writes[0].token, "56|private-secret");
  assert.ok(!writes.some(call => call.body.object === "page"));
});

test("Meta refusal leaves the callback and WABA unchanged", async () => {
  const fixture = metaFixture({ rejectConfirmation: true });
  await fixture.api.validate();
  await assert.rejects(fixture.api.configure(callback), /Cancelled/);
  assert.equal(fixture.calls.filter(call => call.method === "POST").length, 0);
});

test("Meta rejects overrides and incompatible field versions without modifying them", async () => {
  for (const options of [{ override: true, installed: true }, { version: "v24.0" }]) {
    const fixture = metaFixture(options);
    await fixture.api.validate();
    await assert.rejects(fixture.api.configure(callback), /override|different Graph version/);
    assert.equal(fixture.calls.filter(call => call.method === "POST").length, 0);
  }
});

test("Meta rejects phone-level overrides before mutation and rechecks routing before success", async () => {
  const before = metaFixture({ phoneOverride: true });
  await assert.rejects(before.api.validate(), /phone-number.*override/i);
  assert.equal(before.calls.filter(call => call.method === "POST").length, 0);
  const after = metaFixture({ overrideAfterWrite: true });
  await after.api.validate();
  await assert.rejects(after.api.configure(callback), /phone-number.*override/i);
});

test("Meta retains an existing WABA installation and rejects an unhealthy callback before writes", async () => {
  const fixture = metaFixture({ installed: true });
  await fixture.api.validate();
  await fixture.api.configure(callback);
  assert.equal(fixture.calls.filter(call => call.method === "POST" && call.path.endsWith("subscribed_apps")).length, 0);
  fixture.calls.length = 0;
  fixture.api.fetcher = async () => new Response("wrong");
  await assert.rejects(fixture.api.configure(callback), /verification failed/);
  assert.equal(fixture.calls.filter(call => call.method === "POST").length, 0);
});

test("Meta expired tokens fail before any subscription mutations", async () => {
  for (const reply of [{ data: { is_valid: false } }, { data: { is_valid: true, expires_at: 1 } }, new ApiError("Meta", 400, 190)]) {
    const api = new MetaSetup(metaEnv, { request: async () => { if (reply instanceof Error) throw reply; return reply; } });
    await assert.rejects(api.validate(), /META_ACCESS_TOKEN/);
  }
});

test("cancelling Meta setup before its write cannot switch the callback", async () => {
  const fixture = metaFixture(), controller = new AbortController();
  await fixture.api.validate();
  fixture.api.fetcher = async url => {
    controller.abort(new SetupError("stopped"));
    return new Response(url.searchParams.get("hub.challenge"));
  };
  await assert.rejects(fixture.api.configure(callback, { signal: controller.signal }), /stopped/);
  assert.equal(fixture.calls.filter(call => call.method === "POST").length, 0);
});

test("Meta pagination uses opaque cursors without following credential-bearing next URLs", async () => {
  const urls = [];
  const api = new MetaSetup(metaEnv, { request: async url => {
    urls.push(url);
    return urls.length === 1 ? { data: [], paging: { next: "https://evil.example?access_token=secret", cursors: { after: "cursor" } } } : { data: [{ id: "12" }] };
  } });
  assert.deepEqual(await api.pages("34/phone_numbers", "id"), [{ id: "12" }]);
  assert.equal(new URL(urls[1]).hostname, "graph.facebook.com");
  assert.equal(new URL(urls[1]).searchParams.get("after"), "cursor");
});

test("Azure binds management login to the explicit tenant/subscription", async () => {
  const calls = [];
  const azure = new Azure(target, {
    command: async (exe, args) => {
      calls.push(args);
      if (args[0] === "cloud") return "AzureCloud";
      if (args.includes("show")) return { id: subscription, tenantId: tenant };
      return { accessToken: "private-token", tenant, subscription };
    },
    request: async (url, token) => { assert.equal(token, "private-token"); assert.ok(url.startsWith("https://management.azure.com/subscriptions/")); return {}; },
  });
  await azure.connect();
  await azure.arm(azure.groupPath);
  assert.ok(calls.filter(args => args[0] === "account").every(args => args.includes(subscription)));
  assert.ok(calls.filter(args => args[1] === "get-access-token").every(args => !args.includes("--tenant")));
  const wrong = new Azure(target, { command: async (exe, args) => args[0] === "cloud" ? "AzureCloud" : ({ id: subscription, tenantId: subscription }) });
  await assert.rejects(wrong.connect(), /tenant/);
  const wrongToken = new Azure(target, { command: async () => ({ accessToken: "private-token", tenant: subscription, subscription }) });
  await assert.rejects(wrongToken.token("https://management.azure.com/"), /metadata/);
});

test("Azure absence handling does not hide permission errors or adopt unrelated resources", async () => {
  const azure = new Azure(target);
  azure.arm = async () => { throw new ApiError("Azure", 404); };
  assert.equal(await azure.optional("/missing"), undefined);
  azure.arm = async () => { throw new ApiError("Azure", 403); };
  await assert.rejects(azure.optional("/forbidden"), /403/);
  assert.throws(() => assertOwned({ tags: {} }, "owner"), /not owned/);
  assertOwned({ tags: { "whatsapp-relay-owner": "owner" } }, "owner");
});

function authFixture({ failCredential = false } = {}) {
  const apps = [], resources = new Map(), calls = [];
  const azure = {
    target, groupPath: `/subscriptions/${subscription}/resourceGroups/relay-test`,
    group: async () => {}, optional: async path => resources.get(path),
    arm: async (path, options = {}) => {
      calls.push({ path, ...options });
      if (options.method) resources.set(path, structuredClone(options.body));
      return resources.get(path);
    },
    graph: async (path, options = {}) => {
      calls.push({ path, ...options });
      if (path.startsWith("applications?")) {
        const filter = new URL(`https://graph.example/${path}`).searchParams.get("$filter");
        return { value: apps.filter(app => filter.includes(`'${app.appId}'`) || filter.includes(`'${app.displayName}'`)) };
      }
      if (path === "applications") {
        const app = { ...options.body, id: `object-${apps.length}`, appId: `33333333-3333-3333-3333-${String(apps.length).padStart(12, "0")}` };
        apps.push(app);
        return app;
      }
      if (path.endsWith("addPassword")) {
        if (failCredential) throw new SetupError("uncertain credential");
        return { secretText: "generated-private-secret", keyId: "credential", endDateTime: "2030-01-01T00:00:00Z" };
      }
      if (path.startsWith("servicePrincipals?")) {
        return path.includes("8578e004") ? { value: [{ oauth2PermissionScopes: [{ id: tenant, value: "CopilotStudio.Copilots.Invoke", isEnabled: true }] }] } : { value: [{ id: "principal" }] };
      }
      throw new Error("Unexpected fake Graph route");
    },
  };
  return { azure, calls, resources };
}

test("auth setup reruns reuse owned apps/secrets; explicit reuse makes no writes", async t => {
  const path = join(await temporary(t), ".env");
  await writeFile(path, "GHCP_CLOUD=Prod\nKEEP=unchanged\n");
  const fixture = authFixture(), state = journal();
  const args = { botName: "test-bot", connectionName: "mcs", environment: {} };
  await provisionAuth(fixture.azure, state, path, args);
  await provisionAuth(fixture.azure, state, path, args);
  assert.equal(fixture.calls.filter(call => call.path === "applications").length, 2);
  assert.equal(fixture.calls.filter(call => call.path.endsWith("addPassword")).length, 2);
  const env = await loadEnvironment(path, {});
  assert.equal(env.KEEP, "unchanged");
  assert.equal(env.BOT_OAUTH_CONNECTION, "mcs");
  fixture.calls.length = 0;
  await reuseAuth(fixture.azure, env, args);
  assert.equal(fixture.calls.filter(call => call.method).length, 0);
});

test("uncertain credential issuance blocks silent rotation on retry", async t => {
  const path = join(await temporary(t), ".env");
  await writeFile(path, "GHCP_CLOUD=Prod\n");
  const fixture = authFixture({ failCredential: true }), state = journal();
  const args = { botName: "test-bot", connectionName: "mcs", environment: {} };
  await assert.rejects(provisionAuth(fixture.azure, state, path, args), /uncertain credential/);
  await assert.rejects(provisionAuth(fixture.azure, state, path, args), /outcome is uncertain/);
  assert.equal(fixture.calls.filter(call => call.path.endsWith("addPassword")).length, 1);
});

test("auth refuses unrelated bot names and preexisting credentials", async t => {
  const path = join(await temporary(t), ".env");
  await writeFile(path, "BOT_CLIENT_ID=existing\nBOT_CLIENT_SECRET=private\n");
  const fixture = authFixture();
  await assert.rejects(provisionAuth(fixture.azure, journal(), path, { botName: "test", environment: {} }), /--reuse/);
  assert.equal(fixture.calls.length, 0);
  await writeFile(path, "");
  fixture.azure.optional = async () => ({ tags: {} });
  await assert.rejects(provisionAuth(fixture.azure, journal(), path, { botName: "test", environment: {} }), /not owned/);
});

test("auth reruns reject tenant or connection drift before mutating resources", async t => {
  const path = join(await temporary(t), ".env");
  await writeFile(path, "GHCP_CLOUD=Prod\n");
  const fixture = authFixture(), state = journal();
  const args = { botName: "test-bot", connectionName: "mcs", environment: {} };
  await provisionAuth(fixture.azure, state, path, args);
  fixture.calls.length = 0;
  await updateEnvironment(path, { BOT_TENANT_ID: subscription });
  await assert.rejects(provisionAuth(fixture.azure, state, path, args), /BOT_TENANT_ID/);
  await updateEnvironment(path, { BOT_TENANT_ID: tenant, BOT_OAUTH_CONNECTION: "different" });
  await assert.rejects(provisionAuth(fixture.azure, state, path, args), /BOT_OAUTH_CONNECTION/);
  assert.equal(fixture.calls.length, 0);
});

test("local port collisions are detected without terminating the listener", async t => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  await assert.rejects(checkPort(server.address().port), /unavailable/);
  assert.equal(server.listening, true);
});

test("the tunnel URL comes from host readiness, never the friendly ID or inspection URL", () => {
  assert.equal(tunnelUrl("Inspect traffic at https://inspect.example\nConnect via browser: https://alias-3978.uks1.devtunnels.ms\n"), "https://alias-3978.uks1.devtunnels.ms");
  assert.equal(tunnelUrl("tunnelId: friendly-name.uks1"), undefined);
  assert.throws(() => tunnelUrl("Connect via browser: https://evil.example\n"), /unexpected/);
});

test("owned tunnels are reused; missing ownership or extra ports is refused", async () => {
  const state = journal(), calls = [];
  let tunnel;
  const command = async (exe, args) => {
    calls.push(args);
    if (args[0] === "list") return { tunnels: tunnel ? [tunnel] : [] };
    if (args[0] === "create") { tunnel = { tunnelId: "friendly.uks1", labels: ["whatsapp-relay-owner"], ports: [] }; return { tunnel }; }
    if (args[0] === "show") return { tunnel };
    if (args[0] === "port") { tunnel.ports.push({ portNumber: 3978, protocol: "http" }); return {}; }
    throw new Error("Unexpected tunnel command");
  };
  assert.equal(await ensureTunnel(state, 3978, command), "friendly.uks1");
  await ensureTunnel(state, 3978, command);
  assert.equal(calls.filter(args => args[0] === "create").length, 1);
  tunnel.ports.push({ portNumber: 1234, protocol: "http" });
  await assert.rejects(ensureTunnel(state, 3978, command), /unexpected ports/);
  state.state.tunnelId = "different";
  await assert.rejects(ensureTunnel(state, 3978, command), /another account/);
});

test("only the known empty-list warning permits creating a new tunnel", async () => {
  for (const reply of [{ warning: "Login failed." }, { warning: "No tunnels found.", error: "Forbidden" }, {}]) {
    const calls = [];
    await assert.rejects(ensureTunnel(journal(), 3978, async (exe, args) => {
      calls.push(args);
      return reply;
    }), /ambiguous/);
    assert.equal(calls.length, 1);
  }
});

test("child failure aborts supervision; cleanup terminates only tracked children", async () => {
  const controller = new AbortController(), owned = child();
  const stop = trackChild(owned, "owned", controller, 20);
  owned.emit("close", 1);
  assert.ok(controller.signal.aborted);
  await stop();
  assert.deepEqual(owned.kills, []);
  const live = child();
  await trackChild(live, "live", new AbortController(), 20)();
  assert.deepEqual(live.kills, ["SIGTERM"]);
});

test("tunnel readiness failures and cancellation do not hang", async () => {
  await assert.rejects(waitForTunnel(child(), new AbortController().signal, 5), /public URL/);
  await assert.rejects(waitForTunnel(child(), AbortSignal.abort(new SetupError("stopped"))), /stopped/);
});

test("tunnel readiness tolerates stdout split at every byte of its URL", async () => {
  const line = "Connect via browser: https://alias-3978.uks1.devtunnels.ms\n";
  for (let split = 1; split < line.length; split++) {
    const host = child();
    const ready = waitForTunnel(host, new AbortController().signal);
    host.stdout.write(line.slice(0, split));
    host.stdout.write(line.slice(split));
    assert.equal(await ready, "https://alias-3978.uks1.devtunnels.ms");
  }
});

test("local webhook refusal stops both owned processes and never claims readiness", async () => {
  const children = [], signals = new EventEmitter(), urls = [];
  await assert.rejects(runServices({
    env: {}, config: { port: 3978 }, tunnelId: "friendly.uks1", signals,
    launch: async () => {
      const process = child();
      children.push(process);
      if (children.length === 2) process.stdout.write("Connect via browser: https://alias-3978.uks1.devtunnels.ms\n");
      return process;
    },
    health: async url => { urls.push(url); },
    meta: { configure: async () => { throw new SetupError("Cancelled"); } },
  }), /Cancelled/);
  assert.equal(urls.length, 2);
  assert.ok(children.every(process => process.kills.length === 1));
  assert.equal(signals.listenerCount("SIGINT"), 0);
});

test("local cancellation keeps signal handlers until owned children close", async () => {
  const children = [], signals = new EventEmitter();
  let configured, stopping;
  const ready = new Promise(resolve => { configured = resolve; });
  const cleanupStarted = new Promise(resolve => { stopping = resolve; });
  const running = runServices({
    env: {}, config: { port: 3978 }, tunnelId: "friendly.uks1", signals,
    launch: async () => {
      const process = child();
      process.kill = signal => {
        process.kills.push(signal);
        if (children.every(value => value.kills.length)) stopping();
        return true;
      };
      children.push(process);
      if (children.length === 2) process.stdout.write("Connect via browser: https://alias-3978.uks1.devtunnels.ms\n");
      return process;
    },
    health: async () => {},
    meta: { configure: async () => { configured(); } },
  });
  await ready;
  signals.emit("SIGINT");
  await cleanupStarted;
  try {
    assert.equal(signals.listenerCount("SIGINT"), 1);
    assert.equal(signals.listenerCount("SIGTERM"), 1);
    signals.emit("SIGINT");
    signals.emit("SIGTERM");
    assert.equal(signals.listenerCount("SIGINT"), 1);
    assert.equal(signals.listenerCount("SIGTERM"), 1);
    assert.ok(children.every(process => process.kills.length === 1));
  } finally {
    for (const process of children) process.emit("close", 0);
    await running;
  }
  assert.equal(signals.listenerCount("SIGINT"), 0);
  assert.equal(signals.listenerCount("SIGTERM"), 0);
});

test("deployment settings exclude local port and management secrets while retaining unrelated settings", () => {
  const settings = appSettings({ KEEP: "value", PORT: "3978" }, {
    BOT_CLIENT_SECRET: "runtime-secret", BOT_OAUTH_CLIENT_SECRET: "management-secret", PORT: "3978", PATH: "local",
  });
  assert.equal(settings.KEEP, "value");
  assert.equal(settings.BOT_CLIENT_SECRET, "runtime-secret");
  assert.equal(settings.RELAY_HOST, "0.0.0.0");
  for (const key of ["PORT", "PATH", "BOT_OAUTH_CLIENT_SECRET"]) assert.equal(settings[key], undefined);
  assert.equal(settings.SCM_DO_BUILD_DURING_DEPLOYMENT, "true");
  assert.throws(() => appSettings({ WEBSITE_RUN_FROM_PACKAGE: "1" }, {}), /run-from-package/);
  assert.equal(selectRuntime(["NODE:24-lts", "NODE:22-lts"]), "NODE|22-lts");
  assert.throws(() => selectRuntime(["NODE:20-lts"]), /compatible/);
});

test("source ZIP includes only manifests/build config and source, never credentials or host artifacts", async t => {
  const directory = await temporary(t);
  await mkdir(join(directory, "src"));
  for (const path of ["package.json", "package-lock.json", "tsconfig.json"]) await writeFile(join(directory, path), "{}");
  await writeFile(join(directory, "src/index.ts"), "export {};");
  for (const path of [".env", ".env.local", "debug.log"]) await writeFile(join(directory, path), "private-secret");
  for (const dir of [".setup", "test", "node_modules", "dist", "scripts"]) {
    await mkdir(join(directory, dir));
    await writeFile(join(directory, dir, "secret.ts"), "private-secret");
  }
  const files = unzipSync(await sourceArchive(directory));
  assert.deepEqual(Object.keys(files).sort(), ["package-lock.json", "package.json", "src/index.ts", "tsconfig.json"]);
  assert.ok(Object.values(files).every(bytes => !Buffer.from(bytes).includes("private-secret")));
  if (process.platform !== "win32") {
    await symlink(join(directory, ".env"), join(directory, "src/private.ts"));
    await assert.rejects(sourceArchive(directory), /symbolic links/);
  }
});

test("infrastructure refuses ownership collisions before resource writes and reports failed deployments", async () => {
  const state = journal(), writes = [];
  const azure = {
    target, groupPath: "/subscriptions/test/resourceGroups/test",
    optional: async () => ({ tags: {} }), group: async () => { writes.push("group"); },
    arm: async (path, options = {}) => {
      if (options.method) writes.push(options);
      return { properties: { provisioningState: "Failed" } };
    },
  };
  const args = { appName: "app", planName: "plan", nodeRuntime: "NODE|22-lts", template: {} };
  await assert.rejects(deployInfrastructure(azure, state, args), /not owned/);
  assert.equal(writes.length, 0);
  azure.optional = async () => undefined;
  await assert.rejects(deployInfrastructure(azure, state, args), /partially created/);
  assert.equal(writes[1].body.properties.mode, "Incremental");
  assert.equal(writes[1].body.properties.parameters.nodeRuntime.value, "NODE|22-lts");
  assert.ok(!JSON.stringify(writes).includes("SECRET"));
});
