import { Azure, assertOwned, azureOptions, target } from "./azure.mjs";
import {
  ApiError, dependencies, guid, isMain, loadEnvironment, options, resourceName, runMain,
  SetupError, stateFile, updateEnvironment,
} from "./common.mjs";

const provider = "30dd229c-58e3-4a48-bdfd-91ec48eb906c";
const resourceApp = "8578e004-a5c6-46e7-913e-12f58912df43";
const invokeScope = "https://api.powerplatform.com/CopilotStudio.Copilots.Invoke";
const redirect = "https://token.botframework.com/.auth/web/redirect";

async function beginCreation(record, key, save, create) {
  record[key] = true;
  await save();
  try { return await create(); } catch (error) {
    if (error instanceof ApiError && [400, 401, 403, 404, 422].includes(error.status)) {
      delete record[key];
      await save();
    }
    throw error;
  }
}

async function findApp(azure, filter) {
  const result = await azure.graph(`applications?${new URLSearchParams({
    "$filter": filter, "$select": "id,appId,displayName,notes,signInAudience,web,requiredResourceAccess", "$top": "2",
  })}`);
  if (!Array.isArray(result?.value) || result.value.length > 1) throw new SetupError("Application lookup was ambiguous; no application was adopted.");
  return result.value[0];
}

export function verifyConnection(bot, connection, env, tenant) {
  if (bot?.properties?.msaAppId !== env.BOT_CLIENT_ID ||
      bot.properties.msaAppTenantId?.toLowerCase() !== tenant ||
      bot.properties.msaAppType !== "SingleTenant" ||
      connection?.properties?.serviceProviderId !== provider ||
      !connection.properties.scopes?.split(/\s+/).includes(invokeScope) ||
      !connection.properties.parameters?.some(p => p.key.toLowerCase() === "tenantid" && p.value?.toLowerCase() === tenant)) {
    throw new SetupError("Existing bot/OAuth configuration does not match the requested single-tenant Power Platform setup.");
  }
}

export async function provisionAuth(azure, journal, envPath, { botName, connectionName, environment = process.env } = {}) {
  const { state, save } = journal;
  const marker = `whatsapp-relay:${state.owner}`;
  let env = await loadEnvironment(envPath, environment);
  if (env.GHCP_CLOUD && env.GHCP_CLOUD !== "Prod") {
    throw new SetupError("Automatic OAuth provisioning supports commercial Prod only. Configure other clouds manually.");
  }
  if (env.BOT_TENANT_ID && env.BOT_TENANT_ID.toLowerCase() !== azure.target.tenant) {
    throw new SetupError("BOT_TENANT_ID does not match the requested tenant.");
  }
  if (env.BOT_CLIENT_ID && env.BOT_CLIENT_ID === state.bot?.appId && env.BOT_OAUTH_CONNECTION !== connectionName) {
    throw new SetupError("BOT_OAUTH_CONNECTION does not match the requested connection.");
  }
  for (const prefix of ["BOT", "BOT_OAUTH"]) {
    if (Boolean(env[`${prefix}_CLIENT_ID`]) !== Boolean(env[`${prefix}_CLIENT_SECRET`])) {
      throw new SetupError(`Supply both ${prefix}_CLIENT_ID and ${prefix}_CLIENT_SECRET, or neither, before setup.`);
    }
  }
  if (env.BOT_CLIENT_ID && env.BOT_CLIENT_ID !== state.bot?.appId) {
    throw new SetupError("BOT_CLIENT_ID already exists. Use --reuse to validate existing auth rather than replacing it.");
  }
  const botPath = `${azure.groupPath}/providers/Microsoft.BotService/botServices/${botName}`;
  const currentBot = await azure.optional(botPath);
  assertOwned(currentBot, state.owner);
  if (currentBot && currentBot.properties.msaAppId !== state.bot?.appId) throw new SetupError("The owned bot identity changed; it was not overwritten.");
  const currentConnection = await azure.optional(`${botPath}/connections/${connectionName}`);
  if (currentConnection && currentConnection.properties.clientId !== state.oauth?.appId) throw new SetupError("The OAuth connection belongs to another app; it was not overwritten.");
  const permissions = await azure.graph(`servicePrincipals?${new URLSearchParams({
    "$filter": `appId eq '${resourceApp}'`, "$select": "oauth2PermissionScopes", "$top": "2",
  })}`);
  const scope = permissions?.value?.length === 1 && permissions.value[0].oauth2PermissionScopes?.find(p => p.value === "CopilotStudio.Copilots.Invoke" && p.isEnabled);
  if (!scope?.id) throw new SetupError("The Power Platform delegated invoke permission could not be resolved in this tenant.");
  await azure.group(state.owner);
  for (const key of ["bot", "oauth"]) {
    const name = `${botName}-${key}`;
    const app = await findApp(azure, state[key] ? `appId eq '${state[key].appId}'` : `displayName eq '${name}'`);
    if (app && app.notes !== marker) throw new SetupError("An Entra application with this name/ID is not owned by this setup.");
    if (state[key] && !app) throw new SetupError("A recorded Entra application was not found. Allow for directory replication, then inspect setup records before retrying.");
    const pendingKey = `${key}AppPending`;
    if (!app && state[pendingKey]) {
      throw new SetupError("Application creation has an uncertain outcome. Wait for directory replication and inspect the application before retrying; another application was not created.");
    }
    if (app && (app.signInAudience !== "AzureADMyOrg" || (key === "oauth" &&
        (!app.web?.redirectUris?.includes(redirect) ||
         !app.requiredResourceAccess?.some(resource => resource.resourceAppId === resourceApp &&
           resource.resourceAccess?.some(permission => permission.id === scope.id && permission.type === "Scope")))))) {
      throw new SetupError("The owned Entra application's audience, redirect, or invoke permission changed. Restore its configuration before retrying.");
    }
    const selected = app ?? await beginCreation(state, pendingKey, save, () => azure.graph("applications", { method: "POST", body: {
      displayName: name, notes: marker, signInAudience: "AzureADMyOrg",
      ...(key === "oauth" ? {
        web: { redirectUris: [redirect] },
        requiredResourceAccess: [{ resourceAppId: resourceApp, resourceAccess: [{ id: scope.id, type: "Scope" }] }],
      } : {}),
    } }));
    if (!selected?.id || !selected.appId) throw new SetupError("Graph did not return the created application identifiers.");
    state[key] ??= { objectId: selected.id, appId: selected.appId };
    delete state[pendingKey];
    await save();
    const principals = await azure.graph(`servicePrincipals?${new URLSearchParams({ "$filter": `appId eq '${selected.appId}'`, "$select": "id", "$top": "2" })}`);
    if (!Array.isArray(principals?.value) || principals.value.length > 1) throw new SetupError("Service principal lookup was ambiguous.");
    if (!principals.value.length) await azure.graph("servicePrincipals", { method: "POST", body: { appId: selected.appId } });
    const secretKey = key === "bot" ? "BOT_CLIENT_SECRET" : "BOT_OAUTH_CLIENT_SECRET";
    const idKey = key === "bot" ? "BOT_CLIENT_ID" : "BOT_OAUTH_CLIENT_ID";
    env = await loadEnvironment(envPath, environment);
    if (env[idKey] && env[idKey] !== selected.appId) throw new SetupError(`Existing ${idKey} does not match the recorded application.`);
    if (!env[secretKey]) {
      if (state[key].credentialId || state[key].credentialPending) {
        throw new SetupError("A credential was previously issued or its outcome is uncertain. Restore the private configuration or rotate it manually; no new secret was generated.");
      }
      const credential = await beginCreation(state[key], "credentialPending", save, () => azure.graph(`applications/${selected.id}/addPassword`, { method: "POST", body: {
        passwordCredential: { displayName: "WhatsApp relay sample", endDateTime: new Date(Date.now() + 90 * 86400_000).toISOString() },
      } }));
      if (!credential?.secretText) throw new SetupError("Graph did not return the generated secret. Inspect the application before retrying.");
      await updateEnvironment(envPath, {
        [secretKey]: credential.secretText, [idKey]: selected.appId,
        BOT_TENANT_ID: azure.target.tenant, BOT_OAUTH_CONNECTION: connectionName,
      });
      state[key].credentialId = credential.keyId;
      state[key].credentialExpires = credential.endDateTime;
      state[key].credentialPending = false;
      await save();
      console.log(`${key} credential stored privately; expires ${credential.endDateTime}.`);
    }
  }
  env = await loadEnvironment(envPath, environment);
  await azure.arm(botPath, { method: "PUT", body: {
    location: "global", kind: "azurebot", sku: { name: "F0" },
    tags: { "whatsapp-relay-owner": state.owner },
    properties: { displayName: botName, msaAppId: state.bot.appId, msaAppTenantId: azure.target.tenant, msaAppType: "SingleTenant", endpoint: "" },
  } });
  const path = `${botPath}/connections/${connectionName}`;
  await azure.arm(path, { method: "PUT", body: {
    location: "global", properties: {
      clientId: state.oauth.appId, clientSecret: env.BOT_OAUTH_CLIENT_SECRET,
      serviceProviderId: provider, scopes: `openid profile offline_access ${invokeScope}`,
      parameters: [{ key: "TenantId", value: azure.target.tenant }],
    },
  } });
  verifyConnection(await azure.arm(botPath), await azure.arm(path), env, azure.target.tenant);
  console.log("Bot and OAuth connection configured. Tenant consent and a real user sign-in still need verification.");
}

export async function reuseAuth(azure, env, { botName, connectionName }) {
  if (env.GHCP_CLOUD && env.GHCP_CLOUD !== "Prod") throw new SetupError("This helper validates commercial Prod OAuth only; validate other clouds manually.");
  guid(env.BOT_CLIENT_ID, "BOT_CLIENT_ID");
  if (!env.BOT_CLIENT_SECRET || env.BOT_TENANT_ID?.toLowerCase() !== azure.target.tenant) {
    throw new SetupError("Reuse requires BOT_CLIENT_SECRET and the matching BOT_TENANT_ID in private configuration.");
  }
  const path = `${azure.groupPath}/providers/Microsoft.BotService/botServices/${botName}`;
  const connection = await azure.arm(`${path}/connections/${connectionName}`);
  verifyConnection(await azure.arm(path), connection, env, azure.target.tenant);
  const oauth = await findApp(azure, `appId eq '${guid(connection.properties.clientId, "OAuth client ID")}'`);
  if (oauth?.signInAudience !== "AzureADMyOrg" || !oauth.web?.redirectUris?.includes(redirect)) {
    throw new SetupError("The sign-in app does not have the expected tenant audience and OAuth redirect.");
  }
  console.log("Existing auth metadata verified without changes. Secret validity, consent, and agent access require a real sign-in.");
}

export async function main() {
  const args = options({ ...azureOptions, bot: { type: "string" }, connection: { type: "string", default: "mcs" }, reuse: { type: "boolean" } });
  if (args.help) {
    console.log("npm run setup:auth -- --tenant GUID --subscription GUID --group NAME --bot NAME [--location REGION] [--reuse] [--env-file PATH] [--dry-run]\nCreates auth resources only when explicitly run. --reuse validates existing resources without changing them. Consent remains manual.");
    return;
  }
  const selected = target(args);
  const botName = resourceName(args.bot, "--bot");
  const connectionName = resourceName(args.connection, "--connection");
  if (!args.reuse && !selected.location) throw new SetupError("Supply --location for authentication provisioning.");
  if (args["dry-run"]) {
    console.log(`Dry run: ${args.reuse ? "validate existing" : "create/reuse setup-owned"} bot ${botName} in ${selected.group}. No credentials/access were checked; no resources or files were changed.`);
    return;
  }
  await dependencies();
  const azure = new Azure(selected);
  await azure.connect();
  if (args.reuse) {
    const env = await loadEnvironment(args["env-file"]);
    if (env.BOT_OAUTH_CONNECTION !== connectionName) throw new SetupError("BOT_OAUTH_CONNECTION must match --connection for reuse.");
    await reuseAuth(azure, env, { botName, connectionName });
  } else {
    const journal = await stateFile("auth", { ...selected, botName, connectionName });
    try { await provisionAuth(azure, journal, args["env-file"], { botName, connectionName }); }
    finally { await journal.release(); }
  }
}
if (isMain(import.meta.url)) await runMain(main);
