import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cp, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createServer as portProbe } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { parseEnv } from "node:util";
import test from "node:test";
import { root, runtimeKeys } from "../scripts/common.mjs";

const tenant = "11111111-1111-1111-1111-111111111111";
const subscription = "22222222-2222-2222-2222-222222222222";
const target = ["--tenant", tenant, "--subscription", subscription, "--group", "test-rg", "--location", "westeurope"];
const appResource = "8578e004-a5c6-46e7-913e-12f58912df43";

function services() {
  const state = { apps: [], principals: [], passwords: [], resources: {}, calls: [], tunnels: [], subscriptions: [], installed: false };
  const failure = (status, code) => ({ status, body: { error: { code } } });
  function graph(url, method, body) {
    const path = url.pathname.replace("/v1.0/", "");
    const filter = url.searchParams.get("$filter");
    if (path === "applications" && method === "GET") {
      if (state.hideApp) { state.hideApp = false; return { body: { value: [] } }; }
      return { body: { value: state.apps.filter(app => filter.includes(`'${app.appId}'`) || filter.includes(`'${app.displayName}'`)) } };
    }
    if (path === "applications" && method === "POST") {
      if (state.denyApp) { state.denyApp = false; return failure(403, "Authorization_RequestDenied"); }
      const app = { ...body, id: `object-${state.apps.length}`, appId: `33333333-3333-3333-3333-${String(state.apps.length).padStart(12, "0")}` };
      state.apps.push(app);
      if (state.loseApp) { state.loseApp = false; state.hideApp = true; return { transportFailure: true }; }
      return { body: app };
    }
    if (path === "servicePrincipals" && method === "GET") {
      return { body: { value: filter.includes(appResource)
        ? [{ oauth2PermissionScopes: [{ id: tenant, value: "CopilotStudio.Copilots.Invoke", isEnabled: true }] }]
        : state.principals.filter(principal => filter.includes(principal.appId)) } };
    }
    if (path === "servicePrincipals" && method === "POST") {
      assert.ok(!state.principals.some(principal => principal.appId === body.appId));
      const principal = { ...body, id: `principal-${state.principals.length}` };
      state.principals.push(principal);
      return { body: principal };
    }
    if (path.endsWith("/addPassword") && method === "POST") {
      if (state.denyPassword) { state.denyPassword = false; return failure(403, "Authorization_RequestDenied"); }
      const password = { secretText: `fixture-secret-${state.passwords.length}`, keyId: `key-${state.passwords.length}`, endDateTime: body.passwordCredential.endDateTime };
      state.passwords.push(password);
      if (state.losePassword) { state.losePassword = false; return { transportFailure: true }; }
      return { body: password };
    }
    throw new Error("Unexpected Graph request");
  }
  function arm(url, method, body) {
    const path = url.pathname;
    if (path.includes("/deployments/") && method === "PUT") {
      const parameters = body.properties.parameters;
      const prefix = path.split("/providers/")[0];
      for (const [type, key] of [["sites", "appName"], ["serverfarms", "planName"]]) {
        state.resources[`${prefix}/providers/Microsoft.Web/${type}/${parameters[key].value}`] = {
          tags: { "whatsapp-relay-owner": parameters.owner.value },
          properties: { defaultHostName: "test-relay.azurewebsites.net" },
        };
      }
      state.resources[path] = { properties: { provisioningState: "Succeeded" } };
      if (state.loseDeployment) {
        state.loseDeployment = false;
        state.resources[path].properties.provisioningState = "Running";
        return { transportFailure: true };
      }
      return { body: state.resources[path] };
    }
    if (path.endsWith("/config/appsettings/list")) {
      return { body: state.resources[path.slice(0, -5)] ?? { properties: { KEEP: "unrelated" } } };
    }
    if (method === "PUT") {
      state.resources[path] = body;
      return { body };
    }
    return state.resources[path] ? { body: state.resources[path] } : failure(404, "NotFound");
  }
  function meta(url, method, body) {
    if (url.pathname.endsWith("/debug_token")) return { body: { data: { is_valid: true, app_id: "56" } } };
    if (url.pathname.endsWith("/12")) return { body: { id: "12", webhook_configuration: {} } };
    if (url.pathname.endsWith("/phone_numbers")) return { body: { data: [{ id: "12" }] } };
    if (url.pathname.endsWith("/subscriptions")) {
      if (method === "POST") {
        state.subscriptions = [{ ...body, fields: body.fields.split(",").map(name => ({ name, version: "v25.0" })), active: true }];
        if (state.loseSubscription) { state.loseSubscription = false; return { transportFailure: true }; }
        return { body: { success: true } };
      }
      return { body: { data: state.subscriptions } };
    }
    if (url.pathname.endsWith("/subscribed_apps")) {
      if (method === "POST") {
        state.installed = true;
        if (state.loseWaba) { state.loseWaba = false; return { transportFailure: true }; }
        return { body: { success: true } };
      }
      return { body: { data: state.installed ? [{ whatsapp_business_api_data: { id: "56" } }] : [] } };
    }
    throw new Error("Unexpected Meta request");
  }
  state.fetch = ({ url: text, method, body }) => {
    state.calls.push({ type: "http", url: text, method, body });
    const url = new URL(text);
    if (url.hostname === "graph.microsoft.com") return graph(url, method, body);
    if (url.hostname === "management.azure.com") return arm(url, method, body);
    if (url.hostname === "graph.facebook.com") return meta(url, method, body);
    if (url.hostname === "test-relay.azurewebsites.net") return { text: url.pathname === "/health" ? "ok" : url.searchParams.get("hub.challenge") };
    throw new Error("Unexpected HTTP host");
  };
  state.cli = ({ command, args, files }) => {
    state.calls.push({ type: "cli", command, args, files });
    const json = value => ({ stdout: JSON.stringify(value) });
    if (command === "az") {
      if (args[0] === "cloud") return json("AzureCloud");
      if (args[0] === "account" && args[1] === "show") return json({ id: subscription, tenantId: tenant });
      if (args[1] === "get-access-token") {
        if (args.includes("--tenant") && args.includes("--subscription")) return { code: 1 };
        assert.ok(args.includes("--subscription") && args.includes(subscription));
        return json({ accessToken: "fixture-access-token", tenant, subscription });
      }
      if (args[0] === "bicep") return json({ resources: [] });
      if (args[1] === "list-runtimes") return json(["NODE:22-lts"]);
      if (args[1] === "deploy") {
        assert.equal(args[args.indexOf("--async") + 1], "true");
        assert.equal(args[args.indexOf("--track-status") + 1], "false");
        assert.equal(args[args.indexOf("--output") + 1], "json");
        assert.ok(files.includes("src/index.ts") && files.includes("package-lock.json"));
        assert.ok(files.every(path => /^(src\/.*\.ts|package(?:-lock)?\.json|tsconfig\.json)$/.test(path)));
        return json(state.sourceDeployment ?? { status: 4 });
      }
    }
    if (command === "devtunnel") {
      if (args[0] === "--version") return { stdout: "test-cli" };
      if (args[0] === "user") return json({ status: "Logged in" });
      if (args[0] === "list") {
        assert.ok(args[2].length <= 50, "Dev Tunnel ownership label exceeds its 50-character limit");
        const tunnels = state.tunnels.filter(tunnel => tunnel.labels.includes(args[2]));
        return json(tunnels.length ? { tunnels } : { warning: "No tunnels found." });
      }
      if (args[0] === "create") {
        const label = args[args.indexOf("--labels") + 1];
        assert.ok(label.length <= 50);
        assert.match(args[1], /^[a-z0-9][a-z0-9-]{1,47}[a-z0-9]$/);
        const tunnel = { tunnelId: `${args[1]}.uks1`, labels: [label], ports: [] };
        state.tunnels.push(tunnel);
        if (state.loseTunnel) { state.loseTunnel = false; return { code: 1 }; }
        return json({ tunnel });
      }
      const tunnel = state.tunnels.find(tunnel => args.includes(tunnel.tunnelId));
      assert.ok(tunnel);
      if (args[0] === "show") return json({ tunnel: { ...tunnel, ports: tunnel.ports.length ? tunnel.ports : undefined } });
      if (args[0] === "port") {
        assert.equal(tunnel.ports.length, 0);
        tunnel.ports.push({ portNumber: Number(args[args.indexOf("-p") + 1]), protocol: "http" });
        if (state.losePort) { state.losePort = false; return { code: 1 }; }
        return json({ port: tunnel.ports[0] });
      }
      if (args[0] === "host") return { host: true };
    }
    throw new Error("Unexpected CLI command");
  };
  return state;
}

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), "relay-rerun-"));
  const state = services(), errors = [];
  const server = createServer(async (request, response) => {
    try {
      let data = "";
      for await (const chunk of request) data += chunk;
      const result = request.url === "/cli" ? state.cli(JSON.parse(data)) : state.fetch(JSON.parse(data));
      response.end(JSON.stringify(result));
    } catch (error) {
      errors.push(error);
      response.end(JSON.stringify({ code: 1, transportFailure: true }));
    }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  });
  for (const path of ["scripts", "infra", "src", "dist", ".env.example", "package.json", "package-lock.json", "tsconfig.json"]) {
    await cp(join(root, path), join(directory, path), { recursive: true });
  }
  await symlink(join(root, "node_modules"), join(directory, "node_modules"), process.platform === "win32" ? "junction" : "dir");
  const probe = portProbe();
  await new Promise(resolve => probe.listen(0, "127.0.0.1", resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  await writeFile(join(directory, ".env"), [
    `PORT=${port}`, "RELAY_HOST=127.0.0.1", "META_GRAPH_VERSION=v25.0", "META_ACCESS_TOKEN=fixture-meta-token",
    "META_APP_SECRET=fixture-meta-secret", "META_VERIFY_TOKEN=fixture-verify", "META_PHONE_NUMBER_ID=12", "META_WABA_ID=34",
    "GHCP_DIRECT_CONNECT_URL=https://example.com/bot?api-version=1", "GHCP_CLOUD=Prod",
  ].join("\n"));
  const env = { ...process.env };
  for (const key of [...runtimeKeys, "BOT_OAUTH_CLIENT_ID", "BOT_OAUTH_CLIENT_SECRET", "PORT", "RELAY_HOST"]) delete env[key];
  Object.assign(env, {
    RELAY_TEST_SERVICE: `http://127.0.0.1:${server.address().port}`, RELAY_TEST_PORT: String(port),
    NODE_OPTIONS: `--import=${pathToFileURL(join(root, "test/fixtures/setup-preload.mjs")).href}`,
    npm_execpath: join(root, "test/fixtures/setup-cli.mjs"),
  });
  async function run(command, args = [], stopWhenReady = false) {
    const child = spawn(process.execPath, ["--", join(directory, "scripts", `${command}.mjs`), ...args], { cwd: directory, env, stdio: "pipe" });
    let stdout = "", stderr = "", stopped = false;
    const timeout = setTimeout(() => child.kill("SIGTERM"), 30_000);
    child.stdout.on("data", chunk => {
      stdout += chunk;
      if (stopWhenReady && !stopped && stdout.includes("Local relay is ready")) { stopped = true; child.kill("SIGTERM"); }
    });
    child.stderr.on("data", chunk => { stderr += chunk; });
    const code = await new Promise((resolve, reject) => { child.once("error", reject); child.once("close", resolve); });
    clearTimeout(timeout);
    assert.equal(errors.length, 0, errors[0]?.message);
    assert.ok(!`${stdout}${stderr}`.includes("fixture-secret-"));
    return { code, stdout, stderr };
  }
  return { directory, state, run };
}

test("auth CLI reruns preserve app/SP/credential identities and reuse is read-only", async t => {
  const f = await fixture(t);
  const args = [...target, "--bot", "test-bot"];
  let result = await f.run("auth", args);
  assert.equal(result.code, 0, result.stderr);
  const first = await readFile(join(f.directory, ".env"), "utf8");
  result = await f.run("auth", args);
  assert.equal(result.code, 0, result.stderr);
  assert.equal(await readFile(join(f.directory, ".env"), "utf8"), first);
  assert.equal(f.state.apps.length, 2);
  assert.equal(f.state.principals.length, 2);
  assert.equal(f.state.passwords.length, 2);
  const start = f.state.calls.length;
  result = await f.run("auth", [...args, "--reuse"]);
  assert.equal(result.code, 0, result.stderr);
  assert.ok(f.state.calls.slice(start).filter(call => call.type === "http").every(call => call.method === "GET"));
  assert.ok(!(await readdir(join(f.directory, ".setup"))).some(name => name.endsWith(".lock")));
  f.state.apps[1].web.redirectUris = [];
  const drift = await f.run("auth", args);
  assert.equal(drift.code, 1);
  assert.match(drift.stderr, /redirect/);
  assert.equal(f.state.passwords.length, 2);
});

test("definitive permission failures can be retried without duplicate apps or secrets", async t => {
  const f = await fixture(t);
  const args = [...target, "--bot", "test-bot"];
  f.state.denyApp = true;
  assert.equal((await f.run("auth", args)).code, 1);
  assert.equal(f.state.apps.length, 0);
  f.state.denyPassword = true;
  assert.equal((await f.run("auth", args)).code, 1);
  assert.equal(f.state.apps.length, 1);
  assert.equal(f.state.passwords.length, 0);
  const completed = await f.run("auth", args);
  assert.equal(completed.code, 0, completed.stderr);
  assert.equal(f.state.apps.length, 2);
  assert.equal(f.state.passwords.length, 2);
});

test("concurrent auth command runs cannot provision duplicate identities", async t => {
  const f = await fixture(t);
  const args = [...target, "--bot", "test-bot"];
  const results = await Promise.all([f.run("auth", args), f.run("auth", args)]);
  assert.ok(results.some(result => result.code === 0));
  for (const result of results) if (result.code !== 0) assert.match(result.stderr, /locked/);
  assert.equal(f.state.apps.length, 2);
  assert.equal(f.state.principals.length, 2);
  assert.equal(f.state.passwords.length, 2);
});

test("lost application creation responses cannot create duplicate apps during directory replication", async t => {
  const f = await fixture(t);
  f.state.loseApp = true;
  const args = [...target, "--bot", "test-bot"];
  assert.equal((await f.run("auth", args)).code, 1);
  assert.equal(f.state.apps.length, 1);
  const retry = await f.run("auth", args);
  assert.equal(retry.code, 1, "A stale directory lookup must not authorize another POST");
  assert.equal(f.state.apps.length, 1);
  const recovered = await f.run("auth", args);
  assert.equal(recovered.code, 0, recovered.stderr);
  assert.equal(f.state.apps.length, 2);
  assert.equal(f.state.passwords.length, 2);
});

test("lost password responses remain blocked on subsequent actual command runs", async t => {
  const f = await fixture(t);
  f.state.losePassword = true;
  const args = [...target, "--bot", "test-bot"];
  assert.equal((await f.run("auth", args)).code, 1);
  assert.equal((await f.run("auth", args)).code, 1);
  assert.equal(f.state.passwords.length, 1);
});

test("local CLI starts/stops twice, reuses one tunnel/port, and recovers a lost Meta response", async t => {
  const f = await fixture(t);
  const auth = await f.run("auth", [...target, "--bot", "test-bot"]);
  assert.equal(auth.code, 0, auth.stderr);
  f.state.loseTunnel = true;
  assert.equal((await f.run("local", [])).code, 1);
  assert.equal(f.state.tunnels.length, 1);
  f.state.losePort = true;
  assert.equal((await f.run("local", [])).code, 1);
  assert.equal(f.state.tunnels[0].ports.length, 1);
  f.state.loseSubscription = true;
  assert.equal((await f.run("local", [])).code, 1);
  f.state.loseWaba = true;
  assert.equal((await f.run("local", [])).code, 1);
  for (let run = 0; run < 2; run++) {
    const result = await f.run("local", [], true);
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /Local relay is ready/);
  }
  assert.equal(f.state.tunnels.length, 1);
  assert.equal(f.state.tunnels[0].ports.length, 1);
  assert.equal(f.state.subscriptions.length, 1);
  assert.equal(f.state.installed, true);
  assert.equal(f.state.calls.filter(call => call.type === "http" && call.method === "POST" && call.url.includes("/subscribed_apps")).length, 1);
  assert.ok(!(await readdir(join(f.directory, ".setup"))).some(name => name.endsWith(".lock")));
});

test("deployment reruns converge on the same resources and do not overwrite in-flight deployments", async t => {
  const f = await fixture(t);
  const auth = await f.run("auth", [...target, "--bot", "test-bot"]);
  assert.equal(auth.code, 0, auth.stderr);
  const args = [...target, "--app", "test-relay", "--plan", "test-plan", "--accept-cost"];
  f.state.loseDeployment = true;
  assert.equal((await f.run("deploy", args)).code, 1);
  const deployments = () => f.state.calls.filter(call => call.type === "http" && call.method === "PUT" && call.url.includes("/deployments/"));
  const retry = await f.run("deploy", args);
  assert.equal(retry.code, 1, "In-flight ARM deployment must not be overwritten");
  assert.equal(deployments().length, 1);
  const deployment = Object.keys(f.state.resources).find(path => path.includes("/deployments/"));
  f.state.resources[deployment].properties.provisioningState = "Succeeded";
  let result = await f.run("deploy", args);
  assert.equal(result.code, 0, result.stderr);
  const resourceIds = Object.keys(f.state.resources).sort();
  const settingsWrites = () => f.state.calls.filter(call => call.type === "http" && call.method === "PUT" && call.url.includes("/config/appsettings?"));
  assert.equal(settingsWrites().length, 1);
  result = await f.run("deploy", args);
  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(Object.keys(f.state.resources).sort(), resourceIds);
  assert.equal(settingsWrites().length, 1, "Unchanged settings must not cause another restart");
  assert.equal(f.state.apps.length, 2);
  assert.equal(f.state.passwords.length, 2);
  assert.equal(f.state.subscriptions.length, 1);
  const saved = Object.entries(f.state.resources).find(([path]) => path.endsWith("/config/appsettings"))[1].properties;
  assert.equal(saved.KEEP, "unrelated");
  assert.equal(saved.PORT, undefined);
  assert.equal(saved.BOT_OAUTH_CLIENT_SECRET, undefined);
  assert.equal(saved.BOT_CLIENT_ID, parseEnv(await readFile(join(f.directory, ".env"), "utf8")).BOT_CLIENT_ID);
});

test("source deployment requires terminal build success before health or Meta configuration", async t => {
  const f = await fixture(t);
  const auth = await f.run("auth", [...target, "--bot", "test-bot"]);
  assert.equal(auth.code, 0, auth.stderr);
  const args = [...target, "--app", "test-relay", "--plan", "test-plan", "--accept-cost"];
  for (const sourceDeployment of [{ status: 1 }, { status: 3 }, {}]) {
    f.state.sourceDeployment = sourceDeployment;
    const start = f.state.calls.length;
    const result = await f.run("deploy", args);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /did not confirm a successful build/);
    assert.ok(!f.state.calls.slice(start).some(call =>
      call.type === "http" && new URL(call.url).hostname === "test-relay.azurewebsites.net"));
    assert.equal(f.state.subscriptions.length, 0);
    assert.equal(f.state.installed, false);
  }
  f.state.sourceDeployment = { status: 4 };
  const result = await f.run("deploy", args);
  assert.equal(result.code, 0, result.stderr);
  assert.equal(f.state.subscriptions.length, 1);
  assert.equal(f.state.installed, true);
});
