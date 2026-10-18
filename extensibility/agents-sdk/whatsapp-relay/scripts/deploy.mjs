import { lstat, readdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { Azure, assertOwned, azureOptions, target } from "./azure.mjs";
import {
  cliJson, confirm, dependencies, isMain, loadEnvironment, npm, options,
  privateWrite, required, resourceName, root, runMain, runtimeKeys, setupDir,
  SetupError, stateFile, validateRuntime, waitForHealth,
} from "./common.mjs";
import { MetaSetup } from "./meta-setup.mjs";

const webVersion = "2023-12-01";

export function selectRuntime(runtimes) {
  if (!Array.isArray(runtimes)) throw new SetupError("Azure did not return the available Linux runtimes.");
  for (const major of [22, 24]) {
    if (runtimes.some(value => String(value).toLowerCase() === `node:${major}-lts`)) return `NODE|${major}-lts`;
  }
  throw new SetupError("App Service does not advertise a Node LTS runtime compatible with this sample.");
}

export function appSettings(existing, env) {
  if (existing.WEBSITE_RUN_FROM_PACKAGE && existing.WEBSITE_RUN_FROM_PACKAGE !== "0") {
    throw new SetupError("This app uses run-from-package. Remove that configuration deliberately before using source ZIP build automation.");
  }
  const settings = { ...existing };
  for (const key of runtimeKeys) settings[key] = env[key] ?? "";
  delete settings.PORT;
  settings.RELAY_HOST = "0.0.0.0";
  settings.SCM_DO_BUILD_DURING_DEPLOYMENT = "true";
  settings.ENABLE_ORYX_BUILD = "true";
  settings.NPM_CONFIG_PRODUCTION = "false";
  return settings;
}

export async function sourceArchive(directory = root) {
  const files = {};
  async function add(relative) {
    const path = join(directory, relative);
    const info = await lstat(path);
    if (info.isSymbolicLink() || !info.isFile() || info.size > 1024 * 1024) {
      throw new SetupError("Deployment inputs must be regular source files no larger than 1 MiB.");
    }
    files[relative.replaceAll("\\", "/")] = new Uint8Array(await readFile(path));
  }
  async function source(relative) {
    if ((await lstat(join(directory, relative))).isSymbolicLink()) throw new SetupError("Deployment source directories cannot be symbolic links.");
    for (const item of await readdir(join(directory, relative), { withFileTypes: true })) {
      if (item.isSymbolicLink()) throw new SetupError("Deployment source cannot contain symbolic links.");
      if (item.isDirectory()) await source(join(relative, item.name));
      else if (item.name.endsWith(".ts")) await add(join(relative, item.name));
    }
  }
  for (const path of ["package.json", "package-lock.json", "tsconfig.json"]) await add(path);
  await source("src");
  const { zipSync } = await import("fflate");
  return zipSync(files);
}

export async function deployInfrastructure(azure, journal, { appName, planName, nodeRuntime, template, delay = ms => new Promise(r => setTimeout(r, ms)) }) {
  const site = `${azure.groupPath}/providers/Microsoft.Web/sites/${appName}`;
  const plan = `${azure.groupPath}/providers/Microsoft.Web/serverfarms/${planName}`;
  assertOwned(await azure.optional(site, webVersion), journal.state.owner);
  assertOwned(await azure.optional(plan, webVersion), journal.state.owner);
  const deploymentName = `whatsapp-relay-${journal.state.owner}`;
  const deployment = `${azure.groupPath}/providers/Microsoft.Resources/deployments/${deploymentName}`;
  const previous = await azure.optional(deployment, "2022-09-01");
  if (previous && !["Succeeded", "Failed", "Canceled"].includes(previous.properties?.provisioningState)) {
    throw new SetupError(`Azure deployment ${deploymentName} is still active or its status is unknown. Wait for it to finish before retrying; it was not overwritten.`);
  }
  await azure.group(journal.state.owner);
  const values = { appName, planName, nodeRuntime, owner: journal.state.owner, location: azure.target.location };
  await azure.arm(deployment, { method: "PUT", body: { properties: {
    mode: "Incremental", template,
    parameters: Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { value }])),
  } } }, "2022-09-01");
  for (let i = 0; i < 300; i++) {
    const status = await azure.arm(deployment, {}, "2022-09-01");
    if (status.properties?.provisioningState === "Succeeded") return site;
    if (["Failed", "Canceled"].includes(status.properties?.provisioningState)) {
      throw new SetupError(`Azure deployment ${deploymentName} failed. Inspect it in Azure; resources may have been partially created.`);
    }
    await delay(2000);
  }
  throw new SetupError("Azure infrastructure deployment has not finished. Inspect it before retrying; created resources continue to incur charges.");
}

export async function main() {
  const args = options({ ...azureOptions, app: { type: "string" }, plan: { type: "string" }, "accept-cost": { type: "boolean" } });
  if (args.help) {
    console.log("npm run deploy:azure -- --tenant GUID --subscription GUID --group NAME --location REGION --app NAME --plan NAME [--env-file PATH] [--dry-run] [--accept-cost] [--replace-webhook]\nDeploys a paid, single-instance Linux B1 App Service sample. Cost and callback replacement need separate confirmation.");
    return;
  }
  const selected = target(args);
  required(selected.location, "--location");
  const appName = required(args.app, "--app (2-60 letters/digits/hyphens)", /^[a-zA-Z0-9][a-zA-Z0-9-]{0,58}[a-zA-Z0-9]$/);
  const planName = resourceName(args.plan, "--plan");
  if (args["dry-run"]) {
    console.log(`Dry run: one paid Linux B1 plan (${planName}) and one app (${appName}) in ${selected.group}/${selected.location}; source ZIP + Linux build; runtime-only settings; health before confirmed Meta switch. No login, credentials, resource availability, or deployment was checked; nothing changed.`);
    return;
  }
  await dependencies();
  await npm(["run", "build"]);
  const env = await loadEnvironment(args["env-file"]);
  await validateRuntime({ ...env, PORT: "8080", RELAY_HOST: "0.0.0.0" });
  if (env.BOT_TENANT_ID?.toLowerCase() !== selected.tenant) throw new SetupError("BOT_TENANT_ID does not match the deployment tenant.");
  const azure = new Azure(selected);
  await azure.connect();
  const nodeRuntime = selectRuntime(await cliJson("az", ["webapp", "list-runtimes", "--os", "linux", "-o", "json", "--only-show-errors"]));
  const template = await cliJson("az", ["bicep", "build", "--file", join(root, "infra/main.bicep"), "--stdout", "--only-show-errors"]);
  const zip = await sourceArchive();
  const meta = new MetaSetup(env);
  await meta.validate();
  await confirm(`Create/update a paid Linux B1 plan and one App Service in ${selected.group}? Charges continue even when the web app is stopped.`, { approved: args["accept-cost"] });
  const journal = await stateFile("azure", { ...selected, appName, planName });
  const archive = join(setupDir, "source.zip");
  let infrastructureStarted = false;
  try {
    infrastructureStarted = true;
    const site = await deployInfrastructure(azure, journal, { appName, planName, nodeRuntime, template });
    const current = await azure.arm(`${site}/config/appsettings/list`, { method: "POST" }, webVersion);
    if (!current?.properties || typeof current.properties !== "object" || Array.isArray(current.properties)) {
      throw new SetupError("Azure did not return the current app settings; they were not overwritten.");
    }
    const desired = appSettings(current.properties, env);
    if (Object.keys(desired).length !== Object.keys(current.properties).length ||
        Object.entries(desired).some(([key, value]) => current.properties[key] !== value)) {
      await azure.arm(`${site}/config/appsettings`, { method: "PUT", body: { properties: desired } }, webVersion);
    }
    await privateWrite(archive, zip);
    console.log("Deploying source ZIP; App Service will restore/build on Linux. This can take several minutes.");
    const sourceDeployment = await cliJson("az", [
      "webapp", "deploy", "--subscription", selected.subscription, "--resource-group", selected.group,
      "--name", appName, "--src-path", archive, "--type", "zip", "--timeout", "600000",
      "--async", "true", "--track-status", "false", "--only-show-errors", "--output", "json",
    ], { timeoutMs: 660_000 });
    if (sourceDeployment?.status !== 4) {
      throw new SetupError("Source deployment did not confirm a successful build. Inspect App Service deployment history before retrying.");
    }
    const app = await azure.arm(site, {}, webVersion);
    const hostname = app.properties?.defaultHostName;
    if (typeof hostname !== "string" || !/^[a-z0-9.-]+\.azurewebsites\.net$/i.test(hostname)) throw new SetupError("Azure returned an unexpected public hostname.");
    const publicUrl = `https://${hostname}`;
    await waitForHealth(`${publicUrl}/health`, { attempts: 120 });
    console.log(`App Service is healthy at ${publicUrl}. It is still a memory-only, single-instance sample.`);
    await meta.configure(`${publicUrl}/webhook`, { replace: args["replace-webhook"] });
  } catch (error) {
    if (infrastructureStarted) console.error("Setup did not finish. Azure resources may exist and incur charges; inspect them before retrying. No resources were automatically deleted.");
    throw error;
  } finally {
    await rm(archive, { force: true });
    await journal.release();
  }
}
if (isMain(import.meta.url)) await runMain(main);
