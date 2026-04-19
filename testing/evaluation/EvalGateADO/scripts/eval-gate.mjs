#!/usr/bin/env node

/**
 * eval-gate.mjs — Copilot Studio Evaluation API (PPAPI) client for CI/CD.
 *
 * Standalone script for running Copilot Studio evaluations as a pipeline gate.
 * Uses a pre-cached MSAL refresh token (from Azure Key Vault) for unattended auth.
 *
 * Subcommands:
 *   node eval-gate.mjs run             Start eval, poll, check results, exit 0/1
 *   node eval-gate.mjs list-testsets   List available test sets
 *   node eval-gate.mjs resolve-bot     Resolve bot GUID from schema name in the target environment
 *   node eval-gate.mjs auth            Interactive login (one-time setup)
 *
 * Options:
 *   --config <path>          Path to eval-config.json (default: ./eval-config.json)
 *   --environment-id <id>    Override environment ID from config
 *   --environment-url <url>  Override environment URL from config
 *   --agent-id <id>          Override agent ID from config (or auto-resolved from botSchemaName)
 *   --bot-schema-name <name> Bot schema name (e.g., cr981_hotelfinder) — used to resolve agent ID dynamically
 *   --tenant-id <id>         Override tenant ID from config
 *   --client-id <id>         Override app registration client ID from config
 *   --testset-id <id>        Override test set ID from config
 *   --testset-name <name>    Match test set by display name
 *   --mcs-connection-id <id> MCS connection ID for authenticated eval (connector actions, SharePoint, etc.)
 *   --threshold <0.0-1.0>    Override pass threshold from config
 *   --run-name <name>        Display name for the eval run
 *   --output <path>          Write results JSON to this file
 *   --junit-output <path>    Write JUnit XML to this file (for ADO Tests tab)
 *   --token-output <path>    Write updated refresh token to this file
 *
 * Environment variables:
 *   EVAL_REFRESH_TOKEN       Pre-cached MSAL refresh token (from Key Vault)
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { PublicClientApplication } from "@azure/msal-node";

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = { command: null, config: "./eval-config.json" };

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      parsed[key] = args[++i];
    } else if (!parsed.command) {
      parsed.command = args[i];
    }
  }

  if (!parsed.command) {
    die("Usage: eval-gate.mjs <run|list-testsets|resolve-bot|auth> [options]");
  }

  return parsed;
}

function loadConfig(args) {
  let config = {};
  if (existsSync(args.config)) {
    config = JSON.parse(readFileSync(args.config, "utf8"));
    log(`Loaded config from ${args.config}`);
  }

  // CLI flags override config file
  return {
    environmentId: args.environmentId || config.environmentId,
    environmentUrl: args.environmentUrl || config.environmentUrl,
    agentId: args.agentId || config.agentId,
    botSchemaName: args.botSchemaName || config.botSchemaName,
    tenantId: args.tenantId || config.tenantId,
    clientId: args.clientId || config.clientId,
    testSetId: args.testsetId || config.testSetId,
    testSetName: args.testsetName || config.testSetName,
    mcsConnectionId: args.mcsConnectionId || config.mcsConnectionId,
    passThreshold: parseFloat(args.threshold || config.passThreshold || "0.8"),
    runName: args.runName || `Eval ${new Date().toISOString()}`,
    output: args.output,
    junitOutput: args.junitOutput,
    tokenOutput: args.tokenOutput,
  };
}

function validate(config, ...required) {
  for (const key of required) {
    if (!config[key]) die(`Missing required config: ${key}. Set in eval-config.json or --${key.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}`);
  }
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

function log(msg) { console.error(`[eval-gate] ${msg}`); }
function die(msg) { console.error(`[eval-gate] ERROR: ${msg}`); process.exit(1); }

// ---------------------------------------------------------------------------
// Auth — MSAL refresh token flow
// ---------------------------------------------------------------------------

const PP_API_SCOPE = "https://api.powerplatform.com/.default";

async function getToken(config) {
  const refreshToken = process.env.EVAL_REFRESH_TOKEN;
  if (!refreshToken) {
    die("EVAL_REFRESH_TOKEN environment variable is not set. Run 'eval-gate.mjs auth' first, or inject from Key Vault.");
  }

  const pca = new PublicClientApplication({
    auth: {
      clientId: config.clientId,
      authority: `https://login.microsoftonline.com/${config.tenantId}`,
    },
  });

  try {
    const result = await pca.acquireTokenByRefreshToken({
      refreshToken,
      scopes: [PP_API_SCOPE],
    });

    log(`Token acquired (expires ${result.expiresOn.toISOString()})`);

    // Write updated refresh token if available (restrictive permissions)
    if (config.tokenOutput && result.refreshToken) {
      writeFileSync(config.tokenOutput, result.refreshToken, { encoding: "utf8", mode: 0o600 });
      log(`Updated refresh token written to ${config.tokenOutput}`);
    }

    return result.accessToken;
  } catch (err) {
    die(`Token acquisition failed: ${err.message}\nRefresh token may be expired. Re-run 'eval-gate.mjs auth' to get a new one.`);
  }
}

async function interactiveAuth(config) {
  validate(config, "tenantId", "clientId");

  const pca = new PublicClientApplication({
    auth: {
      clientId: config.clientId,
      authority: `https://login.microsoftonline.com/${config.tenantId}`,
    },
  });

  log("Starting device code flow...");
  await pca.acquireTokenByDeviceCode({
    scopes: [PP_API_SCOPE],
    deviceCodeCallback: (response) => {
      console.error("\n" + response.message + "\n");
    },
  });

  // MSAL doesn't expose refresh tokens on the result object.
  // Read from the in-memory cache instead.
  const serialized = pca.getTokenCache().serialize();
  const parsed = JSON.parse(serialized);
  const rtKeys = Object.keys(parsed.RefreshToken || {});

  if (rtKeys.length === 0) {
    die("No refresh token in cache. Ensure the app registration has 'Allow public client flows' set to Yes.");
  }

  const refreshToken = parsed.RefreshToken[rtKeys[0]].secret;
  console.error("\nAuthentication successful!\n");
  console.log(refreshToken);
  console.error(`\nStore it in Key Vault with:`);
  console.error(`  az keyvault secret set --vault-name <kv-name> --name copilot-studio-eval-refresh-token --value "<token>"\n`);
  console.error(`Or pipe directly:`);
  console.error(`  node eval-gate.mjs auth --config eval-config.json | az keyvault secret set --vault-name <kv-name> --name copilot-studio-eval-refresh-token --value @-\n`);
}

// ---------------------------------------------------------------------------
// PPAPI HTTP client
// ---------------------------------------------------------------------------

const API_VERSION = "2024-10-01";

function baseUrl(config) {
  return `https://api.powerplatform.com/copilotstudio/environments/${config.environmentId}/bots/${config.agentId}/api/makerevaluation`;
}

async function ppApi(method, url, accessToken, body) {
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(30_000),
  };
  if (body && method !== "GET") opts.body = JSON.stringify(body);

  const sep = url.includes("?") ? "&" : "?";
  const fullUrl = `${url}${sep}api-version=${API_VERSION}`;

  const res = await fetch(fullUrl, opts);

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    if (res.status === 401 || res.status === 403) die(`Auth failed (${res.status}). Re-run 'auth' to refresh token.\n${errBody.slice(0, 300)}`);
    if (res.status === 409) die(`Conflict (409): An eval run is already in progress. Wait for it to complete.\n${errBody.slice(0, 300)}`);
    if (res.status === 429) die(`Rate limited (429): Max 20 eval runs per bot per 24 hours.\n${errBody.slice(0, 300)}`);
    die(`HTTP ${res.status}: ${errBody.slice(0, 500)}`);
  }

  const text = await res.text();
  return text.trim() ? JSON.parse(text) : null;
}

// ---------------------------------------------------------------------------
// Bot ID resolution — queries Dataverse for the bot GUID by schema name
// ---------------------------------------------------------------------------

async function resolveBotId(config, accessToken) {
  if (config.agentId && !config.agentId.startsWith("<")) return config.agentId;

  if (!config.botSchemaName || !config.environmentUrl) {
    die("To auto-resolve bot ID, set both botSchemaName and environmentUrl in eval-config.json.\nAlternatively, set agentId directly via --agent-id.");
  }

  validate(config, "environmentId");
  log(`Resolving bot ID for schema name: ${config.botSchemaName}`);

  // Query Dataverse OData API — requires a Dataverse-scoped token
  const dvScope = `${config.environmentUrl}.default`;
  const pca = new PublicClientApplication({
    auth: {
      clientId: config.clientId,
      authority: `https://login.microsoftonline.com/${config.tenantId}`,
    },
  });

  let dvToken;
  try {
    const result = await pca.acquireTokenByRefreshToken({
      refreshToken: process.env.EVAL_REFRESH_TOKEN,
      scopes: [dvScope],
    });
    dvToken = result.accessToken;
  } catch (err) {
    die(`Cannot get Dataverse token for bot resolution: ${err.message}\nEnsure your app registration has Dynamics CRM > user_impersonation permission.\nOr set agentId directly via --agent-id.`);
  }

  const schemaName = config.botSchemaName.replace(/'/g, "''");
  const odataFilter = encodeURIComponent(`schemaname eq '${schemaName}'`);
  const odataUrl = `${config.environmentUrl}api/data/v9.2/bots?$filter=${odataFilter}&$select=botid,name,schemaname`;
  const res = await fetch(odataUrl, {
    headers: {
      Authorization: `Bearer ${dvToken}`,
      Accept: "application/json",
      "OData-MaxVersion": "4.0",
      "OData-Version": "4.0",
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    die(`Dataverse query failed (${res.status}): ${errBody.slice(0, 300)}\nSet agentId directly via --agent-id.`);
  }

  const data = await res.json();
  const bots = data?.value || [];

  if (bots.length === 0) {
    die(`Bot '${config.botSchemaName}' not found in environment. Ensure the solution has been imported.`);
  }

  const bot = bots[0];
  log(`Resolved bot ID: ${bot.botid} (${bot.name})`);
  config.agentId = bot.botid;
  return bot.botid;
}

async function resolveTestSetId(config, accessToken) {
  if (config.testSetId && !config.testSetId.startsWith("<")) return config.testSetId;

  log("Resolving test set ID...");
  const data = await ppApi("GET", `${baseUrl(config)}/testsets`, accessToken);
  const testsets = (data?.value || []).filter(ts => ts.state === "Ready" || ts.state === "Active");

  if (testsets.length === 0) {
    die("No test sets found for this bot. Create one in Copilot Studio (Evaluate tab).");
  }

  if (config.testSetName) {
    const match = testsets.find(ts => ts.displayName === config.testSetName);
    if (!match) {
      const available = testsets.map(ts => `  ${ts.displayName} (${ts.id})`).join("\n");
      die(`Test set '${config.testSetName}' not found.\nAvailable:\n${available}`);
    }
    log(`Resolved test set: ${match.displayName} (${match.id}, ${match.totalTestCases} cases)`);
    config.testSetId = match.id;
    return match.id;
  }

  const ts = testsets[0];
  log(`Using test set: ${ts.displayName} (${ts.id}, ${ts.totalTestCases} cases)`);
  config.testSetId = ts.id;
  return ts.id;
}

// ---------------------------------------------------------------------------
// Subcommands
// ---------------------------------------------------------------------------

async function cmdResolvBot(config) {
  validate(config, "environmentId", "tenantId", "clientId");
  const token = await getToken(config);
  const botId = await resolveBotId(config, token);
  console.log(JSON.stringify({ botId, botSchemaName: config.botSchemaName }, null, 2));
}

async function cmdListTestsets(config) {
  validate(config, "environmentId", "tenantId", "clientId");
  const token = await getToken(config);
  if (!config.agentId || config.agentId.startsWith("<")) await resolveBotId(config, token);
  const data = await ppApi("GET", `${baseUrl(config)}/testsets`, token);
  const testsets = data?.value || [];

  console.log(JSON.stringify({ testsets: testsets.map(ts => ({
    id: ts.id,
    displayName: ts.displayName,
    totalTestCases: ts.totalTestCases,
    state: ts.state,
  }))}, null, 2));
}

async function cmdRun(config) {
  validate(config, "environmentId", "tenantId", "clientId");
  const token = await getToken(config);
  if (!config.agentId || config.agentId.startsWith("<")) await resolveBotId(config, token);
  if (!config.testSetId || config.testSetId.startsWith("<")) await resolveTestSetId(config, token);

  // Step 1: Start eval run
  log(`Starting eval run: "${config.runName}"`);
  log(`Test set: ${config.testSetId} | Threshold: ${(config.passThreshold * 100).toFixed(0)}%`);

  const runBody = {
    runOnPublishedBot: false,
    evaluationRunName: config.runName,
  };
  if (config.mcsConnectionId) {
    runBody.mcsConnectionId = config.mcsConnectionId;
    log(`Using MCS connection: ${config.mcsConnectionId}`);
  } else {
    log("No mcsConnectionId — authenticated actions/knowledge sources won't work during eval");
  }

  const startData = await ppApi("POST", `${baseUrl(config)}/testsets/${config.testSetId}/run`, token, runBody);

  const runId = startData.runId;
  log(`Run started: ${runId}`);

  // Step 2: Poll until complete (max 10 min, every 20s)
  let state = "unknown";
  for (let i = 0; i < 30; i++) {
    await sleep(20_000);
    const status = await ppApi("GET", `${baseUrl(config)}/testruns/${runId}`, token);
    state = status.state;
    const processed = status.testCasesProcessed || 0;
    const total = status.totalTestCases || 0;
    log(`Progress: ${processed}/${total} (${state})`);

    if (["Completed", "Failed", "Cancelled", "Abandoned"].includes(state)) break;
  }

  if (state !== "Completed") {
    die(`Eval run did not complete (state: ${state})`);
  }

  // Step 3: Fetch results
  const results = await ppApi("GET", `${baseUrl(config)}/testruns/${runId}`, token);

  if (config.output) {
    writeFileSync(config.output, JSON.stringify(results, null, 2), "utf8");
    log(`Results written to ${config.output}`);
  }

  // Step 4: Evaluate pass/fail
  const testCases = results.testCasesResults || [];
  const total = testCases.length;

  function getOverallStatus(tc) {
    const metrics = tc.metricsResults || [];
    if (metrics.length === 0) return "Error";
    const allPass = metrics.every(m => m.result?.status === "Pass");
    const anyError = metrics.some(m => m.result?.status === "Error");
    if (allPass) return "Pass";
    if (anyError) return "Error";
    return "Fail";
  }

  const passed = testCases.filter(tc => getOverallStatus(tc) === "Pass").length;
  const failed = total - passed;
  const passRate = total > 0 ? passed / total : 0;

  console.log("");
  console.log("=========================================");
  console.log(`  EVAL RESULTS: ${passed}/${total} passed (${(passRate * 100).toFixed(1)}%)`);
  console.log(`  Threshold:    ${(config.passThreshold * 100).toFixed(0)}%`);
  console.log(`  Verdict:      ${passRate >= config.passThreshold ? "PASS" : "FAIL"}`);
  console.log("=========================================");

  if (failed > 0) {
    console.log("\nFailed test cases:");
    for (const tc of testCases.filter(t => getOverallStatus(t) !== "Pass")) {
      const failedMetrics = (tc.metricsResults || [])
        .filter(m => m.result?.status !== "Pass")
        .map(m => `${m.type}: ${m.result?.status} (${Object.entries(m.result?.data || {}).filter(([,v]) => v === "No").map(([k]) => k).join(", ") || m.result?.errorReason || "unknown"})`)
        .join("; ");
      console.log(`  - ${tc.testCaseId}: ${getOverallStatus(tc)} [${failedMetrics}]`);
    }
  }

  // Calculate run duration
  const startTime = results.startTime ? new Date(results.startTime) : null;
  const endTime = results.endTime ? new Date(results.endTime) : null;
  const durationSec = (startTime && endTime) ? ((endTime - startTime) / 1000).toFixed(1) : "0";

  // Write JUnit XML for ADO Tests tab
  if (config.junitOutput) {
    const escXml = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    function metricSummary(tc) {
      return (tc.metricsResults || []).map(m => {
        const data = m.result?.data || {};
        const dims = Object.entries(data).map(([k, v]) => `${k}: ${v}`).join(", ");
        return `[${m.type}] status=${m.result?.status} | ${dims}${m.result?.errorReason ? ` | error: ${m.result.errorReason}` : ""}${m.result?.aiResultReason ? `\nAI reason: ${m.result.aiResultReason}` : ""}`;
      }).join("\n");
    }

    const perTestDuration = total > 0 ? (parseFloat(durationSec) / total).toFixed(1) : "0";

    const tcXml = testCases.map(tc => {
      const name = escXml(tc.testCaseId);
      const status = getOverallStatus(tc);
      const details = escXml(metricSummary(tc));

      if (status === "Pass") {
        return `    <testcase name="${name}" classname="CopilotStudioEval" time="${perTestDuration}">\n      <system-out>${details}</system-out>\n    </testcase>`;
      }

      const failedMetrics = (tc.metricsResults || [])
        .filter(m => m.result?.status !== "Pass")
        .map(m => {
          const failedDims = Object.entries(m.result?.data || {}).filter(([,v]) => v === "No").map(([k]) => k).join(", ");
          return `${m.type}: ${m.result?.status} (${failedDims || m.result?.errorReason || "unknown"})`;
        }).join("; ");

      return `    <testcase name="${name}" classname="CopilotStudioEval" time="${perTestDuration}">\n      <failure message="${escXml(failedMetrics)}">${details}</failure>\n    </testcase>`;
    }).join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="Copilot Studio Eval: ${escXml(config.runName)}" tests="${total}" failures="${failed}" time="${durationSec}">
${tcXml}
  </testsuite>
</testsuites>`;

    writeFileSync(config.junitOutput, xml, "utf8");
    log(`JUnit XML written to ${config.junitOutput}`);
  }

  // Output summary as JSON
  console.log("\n" + JSON.stringify({
    runId,
    runName: config.runName,
    total,
    passed,
    failed,
    passRate,
    threshold: config.passThreshold,
    verdict: passRate >= config.passThreshold ? "PASS" : "FAIL",
  }, null, 2));

  if (passRate < config.passThreshold) {
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const args = parseArgs();
const config = loadConfig(args);

switch (args.command) {
  case "run":
    await cmdRun(config);
    break;
  case "list-testsets":
    await cmdListTestsets(config);
    break;
  case "resolve-bot":
    await cmdResolvBot(config);
    break;
  case "auth":
    await interactiveAuth(config);
    break;
  default:
    die(`Unknown command: ${args.command}\nCommands: run, list-testsets, resolve-bot, auth`);
}
