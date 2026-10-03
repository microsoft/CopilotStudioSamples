#!/usr/bin/env node
//
// Post-deploy smoke test for the M365 LangGraph MCS Tool sample.
//
// It drives the *deployed* bot over the Direct Line channel:
//   1. Resolves the bot name + resource group from env/.env.<env> (written by `atk provision`).
//   2. Enables the Direct Line channel and reads its secret via the Azure CLI
//      (or uses DIRECTLINE_SECRET if you set it yourself).
//   3. Starts a conversation, sends a hotel prompt, and polls for the streamed reply.
//   4. Because every turn requires the `MCS` sign-in, if the bot returns a sign-in card
//      the script prints the sign-in URL — open it once, then re-run.
//
// Usage:
//   npm run smoke                       # env dev, default hotel prompt
//   ENV=dev npm run smoke               # target a different toolkit environment
//   SMOKE_PROMPT="Hotels in the policy" npm run smoke
//   DIRECTLINE_SECRET=xxxxx npm run smoke   # skip the Azure CLI step
//
// Requirements: Node 22+ (global fetch), and either DIRECTLINE_SECRET or the Azure CLI
// (`az login`) signed in to the subscription that holds the bot.

import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = join(__dirname, "..");
const ENV_NAME = process.env.ENV || "dev";
const PROMPT = process.env.SMOKE_PROMPT || "What are the available hotels?";
const DL_BASE = "https://directline.botframework.com/v3/directline";
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 120000;
const USER_ID = "smoke-tester";

const c = {
  bold: (s) => `\u001b[1m${s}\u001b[0m`,
  red: (s) => `\u001b[31m${s}\u001b[0m`,
  green: (s) => `\u001b[32m${s}\u001b[0m`,
  yellow: (s) => `\u001b[33m${s}\u001b[0m`,
  dim: (s) => `\u001b[2m${s}\u001b[0m`,
};

function step(msg) {
  console.log(`\n${c.bold(msg)}`);
}
function info(msg) {
  console.log(`  ${msg}`);
}
function fail(msg) {
  console.error(`${c.red("Error:")} ${msg}`);
  process.exit(1);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- Load env/.env.<env> (+ .user) into a plain object ----------------------
function loadEnvFile(file) {
  const out = {};
  if (!existsSync(file)) return out;
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return out;
}

function loadConfig() {
  const envDir = join(PROJECT_DIR, "env");
  const merged = {
    ...loadEnvFile(join(envDir, `.env.${ENV_NAME}`)),
    ...loadEnvFile(join(envDir, `.env.${ENV_NAME}.user`)),
    ...process.env,
  };
  return merged;
}

// --- Azure CLI helpers ------------------------------------------------------
function az(args) {
  try {
    const stdout = execFileSync("az", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true, stdout };
  } catch (err) {
    return {
      ok: false,
      stdout: err.stdout?.toString() ?? "",
      stderr: err.stderr?.toString() ?? err.message,
    };
  }
}

function resolveDirectLineSecret(cfg) {
  if (cfg.DIRECTLINE_SECRET) {
    info("Using DIRECTLINE_SECRET from the environment.");
    return cfg.DIRECTLINE_SECRET;
  }

  const botName =
    cfg.BOTSERVICENAME ||
    (cfg.RESOURCE_SUFFIX ? `bot${cfg.RESOURCE_SUFFIX}-bot` : "");
  const resourceGroup = cfg.AZURE_RESOURCE_GROUP_NAME;

  if (!botName || !resourceGroup) {
    fail(
      "Cannot locate the bot. Provision first (scripts/deploy.sh), or set DIRECTLINE_SECRET.\n" +
        `  Looked for BOTSERVICENAME/RESOURCE_SUFFIX and AZURE_RESOURCE_GROUP_NAME in env/.env.${ENV_NAME}.\n` +
        `  Found: bot='${botName || "(none)"}', resourceGroup='${resourceGroup || "(none)"}'.`
    );
  }

  info(`Enabling Direct Line on bot '${botName}' (resource group '${resourceGroup}')...`);
  const probe = az(["account", "show", "-o", "none"]);
  if (!probe.ok) {
    fail(
      "Azure CLI is not signed in. Run `az login` (and `az account set --subscription <id>`), " +
        "or set DIRECTLINE_SECRET.\n  " +
        probe.stderr.trim()
    );
  }

  const res = az([
    "bot",
    "directline",
    "create",
    "--name",
    botName,
    "--resource-group",
    resourceGroup,
    "-o",
    "json",
  ]);
  if (!res.ok) {
    fail(
      "`az bot directline create` failed. Ensure the Azure CLI targets the right subscription " +
        "and the bot exists.\n  " +
        res.stderr.trim()
    );
  }

  let secret;
  try {
    const parsed = JSON.parse(res.stdout);
    const sites =
      parsed?.properties?.properties?.sites ?? parsed?.properties?.sites ?? [];
    secret = sites.find((s) => s?.key)?.key;
  } catch {
    /* fall through */
  }
  if (!secret) {
    fail(
      "Enabled Direct Line but could not read the channel secret from the CLI output. " +
        "Retrieve it from the Azure portal (Bot → Channels → Direct Line) and pass DIRECTLINE_SECRET."
    );
  }
  info(c.green("Direct Line secret acquired."));
  return secret;
}

// --- Direct Line REST -------------------------------------------------------
async function dlFetch(path, token, options = {}) {
  const res = await fetch(`${DL_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    throw new Error(
      `Direct Line ${options.method || "GET"} ${path} → ${res.status}: ${
        body?.error?.message || text
      }`
    );
  }
  return body;
}

function extractSignInUrl(activity) {
  for (const att of activity.attachments || []) {
    const ct = att.contentType || "";
    if (
      ct === "application/vnd.microsoft.card.oauth" ||
      ct === "application/vnd.microsoft.card.signin"
    ) {
      const buttons = att.content?.buttons || [];
      const url = buttons.find((b) => b?.value)?.value;
      return { url: url || null, connectionName: att.content?.connectionName };
    }
  }
  return null;
}

function textFromActivity(a) {
  if (a.text) return a.text;
  // Streaming responses arrive as typing activities carrying incremental text.
  if (a.type === "typing" && a.text) return a.text;
  return "";
}

async function main() {
  console.log(c.bold(`M365 LangGraph MCS Tool — smoke test (env: ${ENV_NAME})`));
  const cfg = loadConfig();

  step("1. Resolving Direct Line channel");
  const secret = resolveDirectLineSecret(cfg);

  step("2. Starting a Direct Line conversation");
  const conv = await dlFetch("/conversations", secret, { method: "POST" });
  const conversationId = conv.conversationId;
  const token = conv.token || secret;
  if (!conversationId) fail("Direct Line did not return a conversationId.");
  info(`conversationId: ${conversationId}`);

  step("3. Sending the prompt");
  info(`"${PROMPT}"`);
  await dlFetch(`/conversations/${conversationId}/activities`, token, {
    method: "POST",
    body: JSON.stringify({
      type: "message",
      from: { id: USER_ID, name: "Smoke Tester" },
      text: PROMPT,
    }),
  });

  step("4. Waiting for the agent's reply");
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let watermark = null;
  let finalText = "";
  let sawTyping = false;

  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    const qs = watermark ? `?watermark=${watermark}` : "";
    const page = await dlFetch(
      `/conversations/${conversationId}/activities${qs}`,
      token
    );
    watermark = page.watermark ?? watermark;

    const botActivities = (page.activities || []).filter(
      (a) => a.from?.id && a.from.id !== USER_ID
    );

    for (const a of botActivities) {
      const signIn = extractSignInUrl(a);
      if (signIn) {
        console.log(`\n${c.yellow("Sign-in required (one-time).")}`);
        info(
          `The bot's '${
            signIn.connectionName || cfg.MCS_CONNECTION_NAME || "mcs"
          }' connection needs delegated Copilot Studio access.`
        );
        if (signIn.url) {
          info("Open this URL, complete sign-in, then re-run `npm run smoke`:");
          console.log(`\n  ${c.bold(signIn.url)}\n`);
        } else {
          info(
            "The sign-in card did not include a link (token-exchange card). " +
              "Complete the sign-in once in Teams / Microsoft 365 Copilot, then re-run."
          );
        }
        process.exit(2);
      }

      if (a.type === "typing") sawTyping = true;
      const t = textFromActivity(a);
      // Later chunks carry the cumulative answer; keep the longest we've seen.
      if (t && t.length >= finalText.length) finalText = t;
      else if (a.type === "message" && t) finalText = t;
    }

    if (finalText) {
      const done = botActivities.some((a) => a.type === "message" && a.text);
      if (done) break;
    }
  }

  step("5. Result");
  if (!finalText) {
    if (sawTyping) {
      fail(
        "The agent started responding (typing) but no message completed within " +
          `${POLL_TIMEOUT_MS / 1000}s. Check the App Service logs.`
      );
    }
    fail(
      "No reply received. Verify the deploy succeeded, MCS_ENVIRONMENT_ID / MCS_SCHEMA_NAME " +
        "point at a published agent, and the sign-in completed."
    );
  }

  console.log(`\n${c.green("Agent reply:")}\n`);
  console.log(finalText.trim());
  console.log(`\n${c.green("Smoke test passed.")} The full chain responded end-to-end.`);
}

main().catch((err) => {
  console.error(`\n${c.red("Smoke test failed:")} ${err.message}`);
  process.exit(1);
});
