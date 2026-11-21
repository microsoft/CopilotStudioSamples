import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { unzipSync } from "fflate";
import { root, waitForHealth } from "../scripts/common.mjs";
import { sourceArchive } from "../scripts/deploy.mjs";
import { trackChild } from "../scripts/local.mjs";

const execute = promisify(execFile);
async function temporary(t) {
  const directory = await mkdtemp(join(tmpdir(), "whatsapp-cli-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test("every command supports offline, credential-free help and dry runs", async t => {
  const directory = await temporary(t);
  const target = ["--tenant", "11111111-1111-1111-1111-111111111111", "--subscription", "22222222-2222-2222-2222-222222222222",
    "--group", "test-rg", "--location", "westeurope", "--env-file", join(directory, "nonexistent.env")];
  const commands = [
    ["local", []],
    ["auth", [...target, "--bot", "test-bot"]],
    ["deploy", [...target, "--app", "test-app", "--plan", "test-plan"]],
  ];
  for (const [name, args] of commands) for (const mode of ["--help", "--dry-run"]) {
    const result = await execute(process.execPath, ["--", join(root, "scripts", `${name}.mjs`), ...args, mode], {
      cwd: directory, timeout: 10_000,
      env: { ...process.env, PATH: directory, META_ACCESS_TOKEN: "must-not-be-logged", BOT_CLIENT_SECRET: "must-not-be-logged" },
    });
    assert.match(result.stdout, mode === "--help" ? /npm run/ : /Dry run:/);
    assert.ok(!`${result.stdout}${result.stderr}`.includes("must-not-be-logged"));
  }
});

test("setup entrypoints execute through a directory symlink instead of silently exiting", async t => {
  const directory = await temporary(t);
  const link = join(directory, "linked-sample");
  await symlink(root, link, process.platform === "win32" ? "junction" : "dir");
  const result = await execute(process.execPath, ["--", join(link, "scripts/auth.mjs"), "--help"], { timeout: 10_000 });
  assert.match(result.stdout, /npm run setup:auth/);
});

test("the actual source-only deployment ZIP builds without tests or setup scripts", async t => {
  const directory = await temporary(t);
  const archive = unzipSync(await sourceArchive());
  for (const [path, bytes] of Object.entries(archive)) {
    assert.match(path, /^(?:src\/.*\.ts|package(?:-lock)?\.json|tsconfig\.json)$/);
    await mkdir(dirname(join(directory, path)), { recursive: true });
    await writeFile(join(directory, path), bytes);
  }
  await symlink(join(root, "node_modules"), join(directory, "node_modules"), process.platform === "win32" ? "junction" : "dir");
  await execute(process.execPath, [join(root, "node_modules/typescript/bin/tsc"), "--project", join(directory, "tsconfig.json")], { timeout: 30_000 });
  assert.match(await readFile(join(directory, "dist/src/index.js"), "utf8"), /config\.host/);
  const manifest = JSON.parse(Buffer.from(archive["package.json"]).toString());
  assert.equal(manifest.scripts["start:azure"], "node dist/src/index.js");
});

test("cloud-style startup binds successfully using environment settings without an env file", async t => {
  const directory = await temporary(t);
  const probe = createServer();
  await new Promise(resolve => probe.listen(0, "127.0.0.1", resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const controller = new AbortController();
  const child = spawn(process.execPath, [join(root, "dist/src/index.js")], {
    cwd: directory, stdio: "pipe",
    env: {
      ...process.env, DEBUG: "", NODE_DEBUG: "", RELAY_HOST: "0.0.0.0", PORT: String(port),
      META_GRAPH_VERSION: "v25.0", META_ACCESS_TOKEN: "test-token", META_APP_SECRET: "test-secret",
      META_VERIFY_TOKEN: "test-verify", META_PHONE_NUMBER_ID: "123", META_WABA_ID: "456",
      BOT_CLIENT_ID: "11111111-1111-1111-1111-111111111111",
      BOT_TENANT_ID: "22222222-2222-2222-2222-222222222222", BOT_CLIENT_SECRET: "test-bot-secret",
      BOT_OAUTH_CONNECTION: "mcs", GHCP_DIRECT_CONNECT_URL: "https://example.com/bot?api-version=1",
      GHCP_CLOUD: "Prod", GHCP_FILE_ORIGINS: "",
    },
  });
  child.stdout.resume();
  child.stderr.resume();
  const stop = trackChild(child, "smoke relay", controller, 5000);
  try {
    await waitForHealth(`http://127.0.0.1:${port}/health`, { signal: controller.signal, attempts: 10 });
    const response = await fetch(`http://127.0.0.1:${port}/webhook?hub.mode=subscribe&hub.verify_token=test-verify&hub.challenge=smoke`);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "smoke");
  } finally { await stop(); }
});
