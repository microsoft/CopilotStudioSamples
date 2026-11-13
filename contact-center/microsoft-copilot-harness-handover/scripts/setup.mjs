import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID } from 'node:crypto';
import { parseEnv } from 'node:util';
import spawn from 'cross-spawn';
import { stringify } from 'yaml';
import { zipSync } from 'fflate';
import { appPackage, connector, connectorProperties, hookWorkflow, manifest } from './assets.mjs';
import { load, save as jsonFile, writeProtected, withLock } from './state.mjs';
import { provision as provisionConnector, options as connectorOptions } from './connector.mjs';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sensitive = [];
export function guid(value, field) {
  if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value)) throw new Error(`${field} must be a GUID`);
  return value;
}
export function botServiceFederation(tenantId, name) {
  const bytes = Buffer.from(guid(tenantId, 'tenantId').replaceAll('-', ''), 'hex');
  // The Bot Service subject uses .NET Guid.ToByteArray(), not UTF-8 or RFC byte order.
  bytes.subarray(0, 4).reverse();
  bytes.subarray(4, 6).reverse();
  bytes.subarray(6, 8).reverse();
  return {
    name: guid(name, 'federatedCredentialId'),
    issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
    subject: `/eid1/c/pub/t/${bytes.toString('base64url')}/a/9ExAW52n_ky4ZiS_jhpJIQ/${name}`,
    audiences: ['api://AzureADTokenExchange']
  };
}
export function teamsSsoApi(existing, scope) {
  const scopes = existing.oauth2PermissionScopes ?? [];
  if (scopes.some(item => item.value === scope.value && item.id !== scope.id)) {
    throw new Error('The saved OAuth scope ID does not match the application scope. Resolve the ownership mismatch before updating SSO.');
  }
  const clients = (existing.preAuthorizedApplications ?? []).map(client => ({
    ...client, delegatedPermissionIds: [...client.delegatedPermissionIds]
  }));
  for (const appId of ['1fec8e78-bce4-4aaf-ab1b-5451cc387264', '5e3ce6c0-2b1f-4285-8d4b-75ee78787346']) {
    const client = clients.find(item => item.appId.toLowerCase() === appId);
    if (client) {
      if (!client.delegatedPermissionIds.includes(scope.id)) client.delegatedPermissionIds.push(scope.id);
    } else clients.push({ appId, delegatedPermissionIds: [scope.id] });
  }
  return {
    ...existing, requestedAccessTokenVersion: 2,
    oauth2PermissionScopes: [...scopes.filter(item => item.id !== scope.id), scope],
    preAuthorizedApplications: clients
  };
}
export function validate(config, identities = true) {
  for (const field of ['tenantId', 'subscriptionId', 'environmentId', ...(identities ? ['botClientId', 'oauthClientId', 'oauthServiceProviderId', 'federatedCredentialId'] : [])]) guid(config[field], field);
  if (identities && config.botClientId === config.oauthClientId) throw new Error('Bot and user SSO must use separate app registrations');
  if (config.teamsAppIds !== undefined) {
    if (!config.teamsAppIds || typeof config.teamsAppIds !== 'object' || Array.isArray(config.teamsAppIds)) throw new Error('teamsAppIds must map local/azure targets to GUIDs');
    for (const [target, id] of Object.entries(config.teamsAppIds)) {
      if (!['local', 'azure'].includes(target)) throw new Error('teamsAppIds accepts only local and azure targets');
      guid(id, `teamsAppIds.${target}`);
    }
    if (config.teamsAppIds.local && config.teamsAppIds.local === config.teamsAppIds.azure) throw new Error('Local and Azure Teams app IDs must differ');
  }
  if (!/^[a-z][a-z0-9-]{3,18}$/.test(config.appName)) throw new Error('appName must be 4-19 lowercase letters, digits or hyphens, beginning with a letter');
  if (config.displayName !== undefined && (typeof config.displayName !== 'string' || !config.displayName ||
      config.displayName.trim() !== config.displayName || config.displayName.length > 30)) throw new Error('displayName must be 1-30 characters without surrounding whitespace');
  if (config.appVersion !== undefined && !/^\d+\.\d+\.\d+$/.test(config.appVersion)) throw new Error('appVersion must have three numeric components, for example 1.0.1');
  if (!/^[\w.-]+$/.test(config.resourceGroup) || !/^[a-z0-9]+$/.test(config.location)) throw new Error('Invalid resource group or region');
  if (!/^[a-zA-Z][\w]*$/.test(config.schemaName)) throw new Error('Invalid Studio schema name');
  for (const field of ['websiteUrl', 'privacyUrl', 'termsOfUseUrl']) {
    if (new URL(config[field]).protocol !== 'https:' || config[field].includes('.example')) throw new Error(`${field} must be a real HTTPS URL`);
  }
  if (!config.developerName?.trim()) throw new Error('developerName is required');
  return config;
}
export function executable(name, env = process.env) {
  const override = env[`${name.toUpperCase()}_PATH`];
  if (override) return override;
  if (name === 'devtunnel') {
    const candidate = path.join(root, '.local', 'tools', process.platform === 'win32' ? 'devtunnel.exe' : 'devtunnel');
    if (existsSync(candidate)) return candidate;
  }
  return name;
}
export function run(command, args, json = false, options = {}) {
  const env = options.env ?? process.env;
  const dotnetRoot = path.join(homedir(), '.dotnet');
  const result = spawn.sync(command, args, {
    cwd: root, encoding: 'utf8', shell: false,
    env: { ...env, ...(existsSync(path.join(dotnetRoot, process.platform === 'win32' ? 'dotnet.exe' : 'dotnet')) && !env.DOTNET_ROOT ? { DOTNET_ROOT: dotnetRoot } : {}) },
    maxBuffer: 8 * 1024 * 1024, timeout: 20 * 60_000
  });
  if (result.error || result.status !== 0) {
    let detail = result.error?.message || result.stderr || result.stdout || `Exit ${result.status}`;
    for (const secret of sensitive) detail = detail.replaceAll(secret, '[REDACTED]');
    throw new Error(`${path.basename(command)} failed: ${detail.slice(0, 2500)}`);
  }
  const output = result.stdout.trim();
  if (!json) return output;
  let value;
  try { value = JSON.parse(output); }
  catch { throw new Error(`${path.basename(command)} did not return valid JSON`); }
  if (value.success === false) {
    let message = value.errorMessage || 'CLI operation failed';
    for (const secret of sensitive) message = message.replaceAll(secret, '[REDACTED]');
    throw new Error(message);
  }
  return value;
}
export function argumentsFor(stage, args) {
  const allowed = {
    configure: ['subscription', 'environment-id', 'location', 'schema-name'], doctor: [], identity: ['approve-identity'],
    provision: ['target', 'public-url', 'approve-identity', 'approve-azure'],
    deploy: ['target', 'public-url', 'approve-identity', 'approve-azure', 'approve-connector', 'approve-install', 'teams-only'],
    'local-bot': ['public-url', 'approve-azure'], package: ['target'],
    install: ['target', 'approve-install', 'teams-only'], smoke: ['target']
  }[stage];
  if (!allowed) throw new Error(`Unknown stage: ${stage}`);
  const result = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i].slice(2);
    if (!args[i].startsWith('--') || !allowed.includes(key) || key in result) throw new Error(`Unexpected or duplicate argument: ${args[i]}`);
    const value = key.startsWith('approve-') || key === 'teams-only' ? true : args[++i];
    if (!value || (typeof value === 'string' && value.startsWith('--'))) throw new Error(`--${key} requires a value`);
    result[key] = value;
  }
  if (result.target && !['local', 'azure'].includes(result.target)) throw new Error('--target must be local or azure');
  if (result['teams-only'] && !result['approve-install']) throw new Error('--teams-only requires --approve-install');
  return result;
}

export function createSetup(dependencies = {}) {
  const base = dependencies.root ?? root;
  const local = path.join(base, '.local');
  const configFile = path.join(local, 'config.json');
  const stateFile = path.join(local, 'deployment.json');
  const env = dependencies.env ?? process.env;
  const execute = dependencies.run ?? ((command, args, json, options = {}) => run(command, args, json, { ...options, env: options.env ?? env }));
  const request = dependencies.fetch ?? fetch;
  const az = (args, json = true) => execute(executable('az', env), [...args, '--only-show-errors', '--output', json ? 'json' : 'none'], json);
  function approve(options, flag) {
    if (!options[flag]) throw new Error(`This stage changes cloud resources. Review the README and rerun with --${flag} to explicitly authorize it.`);
  }
  async function context(config) {
    const account = az(['account', 'show', '--subscription', config.subscriptionId]);
    if (account.tenantId !== config.tenantId) throw new Error('Azure subscription tenant does not match configuration');
  }
  async function ownership(config) {
    const file = path.join(local, 'deployment-owner.json');
    const expected = Object.fromEntries(['tenantId', 'subscriptionId', 'resourceGroup', 'appName'].map(key => [key, config[key]]));
    if (existsSync(file)) {
      const saved = await load(file);
      if (Object.keys(expected).some(key => saved[key] !== expected[key])) throw new Error('Deployment state belongs to another target. Use a separate working copy; do not overwrite or delete the ownership record to retarget resources.');
    } else {
      for (const [file, botName] of [[stateFile, `${config.appName}-bot`], [path.join(local, 'deployment.local.json'), `${config.appName}-local-bot`]]) {
        if (existsSync(file) && (await load(file)).botName !== botName) throw new Error('Existing deployment does not match the configured resource names');
      }
      await jsonFile(file, expected);
    }
  }
  function secret(name) {
    const value = env[name];
    if (!value) throw new Error(`Configure ${name} in .local/secrets.env`);
    sensitive.push(value);
    return value;
  }
  async function saveSecret(name, value) {
    sensitive.push(value);
    const file = path.join(local, 'secrets.env');
    const before = existsSync(file) ? await readFile(file, 'utf8') : '';
    const expression = new RegExp(`^${name}=.*$`, 'm');
    const line = `${name}=${JSON.stringify(value)}`;
    await writeProtected(file, expression.test(before) ? before.replace(expression, () => line) : `${before.trimEnd()}\n${line}\n`);
    env[name] = value;
  }
  async function render(config, deployed, target = 'azure') {
    const directory = path.join(local, 'generated', target);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const host = new URL(deployed.appUrl).hostname;
    const connectorFile = path.join(local, `connector.${target}.json`);
    const connectorIdentity = existsSync(connectorFile) ? await load(connectorFile) : undefined;
    if (connectorIdentity && (connectorIdentity.tenantId !== config.tenantId || connectorIdentity.environmentId !== config.environmentId)) throw new Error('Saved connector belongs to another tenant/environment');
    await jsonFile(path.join(directory, 'escalation.swagger.json'), connector(host, connectorIdentity));
    await jsonFile(path.join(directory, 'apiProperties.json'), connectorProperties());
    for (const obsolete of ['hook.swagger.json', 'hook.apiProperties.json']) await rm(path.join(directory, obsolete), { force: true });
    const appDeployment = {
      ...deployed, teamsAppId: config.teamsAppIds?.[target] ?? deployed.botClientId
    };
    await jsonFile(path.join(directory, 'manifest.json'), manifest(config, appDeployment));
    await writeProtected(path.join(local, `teams-m365.${target}.zip`), appPackage(config, appDeployment));
    await jsonFile(path.join(directory, 'deployment-checklist.json'), {
      target, appUrl: deployed.appUrl, botClientId: deployed.botClientId,
      manualSteps: ['Import the connector and agent solutions if not already present', 'Update the imported connector host and select its connection',
        'Publish the imported Studio agent; its scoped hook is already included',
        'Complete delegated user/admin consent as required', 'Verify a real Teams conversation, escalation and same-conversation handback']
    });
    await jsonFile(path.join(directory, 'hook.workflow.json'), hookWorkflow());
    return directory;
  }
  async function registerTeamsApp(config, directory, target) {
    const app = await load(path.join(directory, 'manifest.json'));
    const project = path.join(directory, 'teams-app');
    const environmentFile = path.join(project, 'env', '.env.install');
    await mkdir(path.dirname(environmentFile), { recursive: true, mode: 0o700 });
    await writeProtected(environmentFile, `TEAMSFX_ENV=install\nTEAMS_APP_ID=${app.id}\n`);
    const userFile = `${environmentFile}.user`;
    const userValues = existsSync(userFile) ? parseEnv(await readFile(userFile, 'utf8')) : {};
    for (const key of ['TEAMS_APP_ID', 'TEAMS_APP_TENANT_ID', 'TEAMS_APP_UPDATE_TIME']) delete userValues[key];
    await writeProtected(userFile, Object.entries(userValues).map(([key, value]) => `${key}=${JSON.stringify(value)}\n`).join(''));
    await writeProtected(path.join(project, 'm365agents.yml'), stringify({
      version: 'v1.12', environmentFolderPath: './env',
      provision: [
        { uses: 'teamsApp/create', with: { name: app.name.short }, writeToEnvironmentFile: { teamsAppId: 'TEAMS_APP_ID' } },
        { uses: 'teamsApp/update', with: {
          appPackagePath: path.relative(project, path.join(local, `teams-m365.${target}.zip`)).split(path.sep).join('/')
        } }
      ]
    }));
    // A parent ATK lifecycle may carry another target's app identity.
    const registrationEnv = { ...env, TEAMS_APP_ID: app.id };
    delete registrationEnv.TEAMS_APP_TENANT_ID;
    delete registrationEnv.TEAMS_APP_UPDATE_TIME;
    execute(executable('atk', env), [
      'provision', '--folder', project, '--env', 'install', '--interactive', 'false'
    ], false, { env: registrationEnv });
    // ATK saves the update timestamp in the companion .user environment file.
    const registered = {
      ...parseEnv(await readFile(environmentFile, 'utf8')),
      ...parseEnv(await readFile(userFile, 'utf8'))
    };
    if (registered.TEAMS_APP_ID !== app.id || registered.TEAMS_APP_TENANT_ID !== config.tenantId ||
        !registered.TEAMS_APP_UPDATE_TIME) {
      throw new Error('Teams registration readback did not match the selected app and tenant. Distribution stopped; verify the ATK account and generated teams-app environment before retrying.');
    }
    return app;
  }
  async function packageApp() {
    const files = ['package.json', 'package-lock.json', 'tsconfig.json'];
    const { readdir } = await import('node:fs/promises');
    async function collect(directory) {
      for (const item of await readdir(path.join(root, directory), { withFileTypes: true })) {
        const name = `${directory}/${item.name}`;
        if (item.isDirectory()) await collect(name);
        else files.push(name);
      }
    }
    await collect('src'); await collect('public');
    const entries = {};
    for (const name of files) entries[name] = new Uint8Array(await readFile(path.join(root, name)));
    const destination = path.join(local, 'relay.zip');
    await writeFile(destination, zipSync(entries));
    return destination;
  }
  async function stageMain(stage, options) {
    if (stage === 'configure') {
      const subscription = options.subscription;
      const environmentId = options['environment-id'];
      if (subscription) guid(subscription, 'subscription');
      if (environmentId) guid(environmentId, 'environment-id');
      if (!existsSync(configFile)) {
        if (Boolean(subscription) !== Boolean(environmentId)) {
          throw new Error('Provide --subscription and --environment-id together when creating configuration.');
        }
        const config = await load(path.join(root, 'config.example.json'));
        if (subscription) {
          const account = az(['account', 'show', '--subscription', subscription]);
          Object.assign(config, {
            tenantId: guid(account.tenantId, 'Azure tenantId'), subscriptionId: subscription, environmentId,
            oauthServiceProviderId: 'c00b44ab-5e16-c44c-af26-2fd5bc55eb18',
            appName: `handover-${randomBytes(4).toString('hex')}`, developerName: 'Contoso handover sample'
          });
          const url = `https://${config.appName}-app.azurewebsites.net`;
          Object.assign(config, { websiteUrl: url, privacyUrl: `${url}/privacy`, termsOfUseUrl: `${url}/terms` });
        }
        await jsonFile(configFile, config);
      }
      if (options.subscription && (await load(configFile)).subscriptionId !== options.subscription) throw new Error('Existing configuration selects another subscription; use a separate working copy');
      if (environmentId && (await load(configFile)).environmentId !== environmentId) throw new Error('Existing configuration selects another environment; use a separate working copy');
      if (options.location) {
        const location = options.location;
        if (!/^[a-z0-9]+$/.test(location ?? '')) throw new Error('Invalid Azure region');
        const current = await load(configFile);
        current.location = location;
        await jsonFile(configFile, current);
      }
      if (options['schema-name']) {
        const schemaName = options['schema-name'];
        if (!/^[a-zA-Z][\w]*$/.test(schemaName ?? '')) throw new Error('Invalid Studio schema name');
        const current = await load(configFile);
        current.schemaName = schemaName;
        await jsonFile(configFile, current);
      }
      const secretFile = path.join(local, 'secrets.env');
      if (!existsSync(secretFile)) await writeFile(secretFile, 'BOT_CLIENT_SECRET=\n', { mode: 0o600 });
      console.log('Created/reused .local/config.json and protected .local/secrets.env. Review the target settings before the separately approved identity stage. No cloud changes were made.');
      return;
    }
    if (stage === 'doctor') {
      console.log(`Node ${process.versions.node}`);
      console.log(execute(executable('az', env), ['version', '--output', 'json']));
      if (existsSync(configFile)) {
        const config = validate(await load(configFile), false);
        await context(config);
        console.log(JSON.stringify({ tenantId: config.tenantId, subscriptionId: config.subscriptionId, environmentId: config.environmentId }));
      } else console.log('Run npm run configure to create local configuration.');
      return;
    }
    if (stage === 'smoke') {
      const target = options.target;
      const base = options.appUrl || env.APP_URL || (target
        ? (await load(target === 'local' ? path.join(local, 'deployment.local.json') : stateFile)).appUrl
        : 'http://127.0.0.1:3978');
      const health = await request(new URL('/health', base), { signal: AbortSignal.timeout(15000) });
      const healthBody = health.ok ? await health.json() : undefined;
      if (healthBody?.status !== 'ok') throw new Error('Relay is not healthy');
      for (const [endpoint, body, expected] of [
        ['/api/escalate', { reason: 'Untrusted smoke request', summary: 'Unknown conversation must not route' }, 400],
        ['/api/escalate', { conversationId: 'untrusted', reason: 'Untrusted smoke request', summary: 'Unknown conversation must not route' }, 404]
      ]) {
        const response = await request(new URL(endpoint, base), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), redirect: 'manual', signal: AbortSignal.timeout(15000) });
        if (response.status !== expected) throw new Error(`${endpoint} did not reject an untrusted caller`);
      }
      const channel = await request(new URL('/api/messages', base), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', redirect: 'manual', signal: AbortSignal.timeout(15000) });
      const expectedChannel = healthBody.mode === 'mock' && !target ? [503] : [401, 403];
      if (!expectedChannel.includes(channel.status)) throw new Error('Bot callback did not reject an unauthenticated caller');
      if (target) {
        for (const endpoint of ['/support.html', '/api/support/me']) {
          const response = await request(new URL(endpoint, base), { redirect: 'manual', signal: AbortSignal.timeout(15000) });
          if (response.status !== (target === 'local' ? 404 : 200)) {
            throw new Error(target === 'local' ? `${endpoint} must not be reachable through the callback gateway`
              : `${endpoint} must expose the unauthenticated demo console; check for legacy Easy Auth settings`);
          }
        }
      }
      console.log('Health, conversation validation and callback/console checks passed. Escalation and the demo console have NO authentication; this is not a live channel/handover test.');
      return;
    }
    let config = await load(configFile);
    validate(config, false);
    if (['deploy', 'provision'].includes(stage)) {
      approve(options, 'approve-azure');
      if (options.target === 'local') options['public-url'] = await localOrigin(options);
      if (options['approve-identity']) {
        await stageMain('identity', options);
        config = await load(configFile);
      }
    }
    if (stage === 'identity') {
      approve(options, 'approve-identity');
      await context(config);
      await ownership(config);
      const graphToken = az(['account', 'get-access-token', '--subscription', config.subscriptionId, '--resource-type', 'ms-graph']).accessToken;
      sensitive.push(graphToken);
      const graph = async (endpoint, method = 'GET', body) => {
        const response = await request(`https://graph.microsoft.com/v1.0/${endpoint}`, {
          method, headers: { authorization: `Bearer ${graphToken}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
          body: body && JSON.stringify(body), signal: AbortSignal.timeout(60000)
        });
        if (!response.ok) {
          let detail = '';
          if (response.headers.get('content-type')?.includes('application/json')) {
            const body = await response.json();
            detail = [body.error?.code, body.error?.message].filter(value => typeof value === 'string').join(': ');
            for (const secret of sensitive) detail = detail.replaceAll(secret, '[REDACTED]');
          }
          throw new Error(`Microsoft Graph ${method} ${endpoint.split('?')[0]} failed (${response.status})${detail ? `: ${detail.slice(0, 1500)}` : ''}. No tenant-wide consent was granted automatically.`);
        }
        return response.status === 204 ? undefined : response.json();
      };
      const application = async (file, role) => {
        if (existsSync(file)) {
          const saved = await load(file);
          if (saved.tenantId !== config.tenantId) throw new Error('Saved application belongs to another tenant');
          if (saved.phase !== 'creating') return saved;
          const candidates = await graph(`applications?$filter=displayName eq '${config.appName}-${role}'&$select=id,appId,tags`);
          const matches = candidates.value.filter(app => app.tags?.includes(saved.ownership));
          if (candidates['@odata.nextLink'] || matches.length !== 1) throw new Error(`Application creation is uncertain. Reconcile ${file}; automatic duplicate creation is disabled.`);
          const recovered = { ...saved, objectId: matches[0].id, clientId: matches[0].appId, phase: 'created' };
          await jsonFile(file, recovered);
          return recovered;
        }
        const intent = { tenantId: config.tenantId, ownership: `handover-${randomUUID()}`, phase: 'creating',
          ...(role === 'sso' ? { scopeId: randomUUID(), federationId: randomUUID() } : {}) };
        await jsonFile(file, intent);
        const created = await graph('applications', 'POST', {
          displayName: `${config.appName}-${role}`, signInAudience: 'AzureADMyOrg',
          tags: ['copilot-studio-handover-sample', intent.ownership]
        });
        guid(created.id, 'created application object ID');
        guid(created.appId, 'created application client ID');
        const saved = { ...intent, objectId: created.id, clientId: created.appId, phase: 'created' };
        await jsonFile(file, saved);
        return saved;
      };
      const password = async (owned, app, file, name, key, label) => {
        if (owned.passwordPending) throw new Error(`Credential creation is uncertain. Reconcile ${file} and secrets.env before retrying; no extra credential will be created.`);
        if (owned[key]) {
          const existing = app.passwordCredentials?.find(credential => credential.keyId === owned[key]);
          const expires = Date.parse(existing?.endDateTime);
          if (!Number.isFinite(expires) || expires <= Date.now()) throw new Error(`${name} is expired or missing in Entra. Rotate it explicitly and update its saved credential ID and secrets.env.`);
          secret(name);
          return;
        }
        if (owned.legacyCredential && name === 'BOT_CLIENT_SECRET') { secret(name); return; }
        if (!owned.ownership) {
          secret(name);
          console.warn(`${name}: retaining the recorded legacy app's existing credential. Its expiry cannot be verified until its credential ID is recorded.`);
          return;
        }
        owned.passwordPending = true;
        await jsonFile(file, owned);
        const created = await graph(`applications/${owned.objectId}/addPassword`, 'POST', {
          passwordCredential: { displayName: label, endDateTime: new Date(Date.now() + 90 * 86400000).toISOString() }
        });
        guid(created.keyId, 'created credential ID');
        if (typeof created.secretText !== 'string' || !created.secretText) throw new Error('Entra did not return the new credential; reconcile the pending credential operation before retrying');
        await saveSecret(name, created.secretText);
        owned[key] = created.keyId;
        delete owned.passwordPending;
        await jsonFile(file, owned);
      };
      const principal = await graph("servicePrincipals?$filter=displayName eq 'Power Platform API'&$select=id,appId,oauth2PermissionScopes");
      const matches = principal.value.filter(p => p.oauth2PermissionScopes.some(s => s.value === 'CopilotStudio.Copilots.Invoke'));
      if (principal['@odata.nextLink'] || matches.length !== 1) throw new Error('Expected exactly one Power Platform API exposing CopilotStudio.Copilots.Invoke. A tenant admin must provision/resolve it first.');
      const platform = matches[0], scope = platform.oauth2PermissionScopes.find(s => s.value === 'CopilotStudio.Copilots.Invoke');
      const botFile = path.join(local, 'bot-identity.json');
      let bot;
      if (existsSync(botFile)) bot = await application(botFile, 'bot');
      else if (existsSync(path.join(local, 'deployment.local.json'))) {
        // Preserve the installed bot during migration from the original single-app local setup.
        const deployed = await load(path.join(local, 'deployment.local.json'));
        bot = await load(path.join(local, 'oauth-identity.json'));
        if (bot.tenantId !== config.tenantId || bot.clientId !== deployed.botClientId) throw new Error('Saved local bot identity does not match the recorded application');
        const previous = await graph(`applications/${guid(bot.objectId, 'Bot objectId')}`);
        if (previous.appId !== bot.clientId || !previous.tags?.includes('copilot-studio-handover-sample')) throw new Error('Existing bot app ownership check failed');
        if (!env.BOT_CLIENT_SECRET) await saveSecret('BOT_CLIENT_SECRET', secret('OAUTH_CLIENT_SECRET'));
        bot.legacyCredential = true;
        await jsonFile(botFile, bot);
      } else {
        bot = await application(botFile, 'bot');
      }
      if (bot.tenantId !== config.tenantId) throw new Error('Saved bot app belongs to another tenant');
      const botApp = await graph(`applications/${guid(bot.objectId, 'Bot objectId')}`);
      if (botApp.appId !== bot.clientId || !botApp.tags?.includes('copilot-studio-handover-sample') || (bot.ownership && !botApp.tags.includes(bot.ownership))) throw new Error('Bot app ownership marker is missing');
      await password(bot, botApp, botFile, 'BOT_CLIENT_SECRET', 'credentialId', 'handover-local-bot');
      const botPrincipal = await graph(`servicePrincipals?$filter=appId eq '${bot.clientId}'&$select=id`);
      if (!botPrincipal.value.length) await graph('servicePrincipals', 'POST', { appId: bot.clientId });
      const identityFile = path.join(local, 'sso-identity.json');
      const owned = await application(identityFile, 'sso');
      if (owned.tenantId !== config.tenantId) throw new Error('Saved OAuth app belongs to another tenant');
      const app = await graph(`applications/${guid(owned.objectId, 'OAuth objectId')}`);
      if (app.appId !== owned.clientId || !app.tags?.includes('copilot-studio-handover-sample') || (owned.ownership && !app.tags.includes(owned.ownership))) throw new Error('OAuth app ownership marker is missing');
      if (owned.clientId === bot.clientId) throw new Error('SSO must not reuse the bot app');
      const permissions = structuredClone(app.requiredResourceAccess ?? []);
      const savedDeployment = existsSync(stateFile) ? await load(stateFile) : undefined;
      // Identity reconciliation can precede updating the Bot's old OAuth connection.
      if (savedDeployment) assertDeployment(config, savedDeployment, 'azure', false);
      const ssoResources = [
        `api://botid-${bot.clientId}`,
        ...(savedDeployment ? [`api://botid-${savedDeployment.botClientId}`] : [])
      ];
      let platformPermission = permissions.find(item => item.resourceAppId === platform.appId);
      if (!platformPermission) permissions.push(platformPermission = { resourceAppId: platform.appId, resourceAccess: [] });
      if (!platformPermission.resourceAccess.some(item => item.id === scope.id && item.type === 'Scope')) platformPermission.resourceAccess.push({ id: scope.id, type: 'Scope' });
      const api = teamsSsoApi(app.api ?? {}, { id: owned.scopeId, value: 'defaultScope', isEnabled: true, type: 'User', adminConsentDisplayName: 'Use handover support', adminConsentDescription: 'Allow signed-in users to use the handover relay.', userConsentDisplayName: 'Use handover support', userConsentDescription: 'Use the handover relay as yourself.' });
      if (!app.api?.oauth2PermissionScopes?.some(item => item.id === owned.scopeId)) {
        // Graph validates preauthorizations against already persisted scopes, not this PATCH's new scopes.
        await graph(`applications/${owned.objectId}`, 'PATCH', {
          api: { ...app.api, requestedAccessTokenVersion: 2, oauth2PermissionScopes: api.oauth2PermissionScopes }
        });
      }
      await graph(`applications/${owned.objectId}`, 'PATCH', {
        identifierUris: [...new Set([...(app.identifierUris ?? []), ...ssoResources])],
        requiredResourceAccess: permissions,
        web: { ...app.web,
          redirectUris: [...new Set([...(app.web?.redirectUris ?? []), 'https://token.botframework.com/.auth/web/redirect'])],
          implicitGrantSettings: { ...app.web?.implicitGrantSettings, enableIdTokenIssuance: true }
        },
        api
      });
      const existing = await graph(`servicePrincipals?$filter=appId eq '${owned.clientId}'&$select=id`);
      if (!existing.value.length) await graph('servicePrincipals', 'POST', { appId: owned.clientId });
      const federation = botServiceFederation(config.tenantId, owned.federationId);
      const credentials = await graph(`applications/${owned.objectId}/federatedIdentityCredentials`);
      const existingFederation = credentials.value.find(item => item.name === federation.name);
      if (existingFederation) {
        if (existingFederation.issuer !== federation.issuer || existingFederation.subject !== federation.subject ||
            JSON.stringify(existingFederation.audiences) !== JSON.stringify(federation.audiences)) throw new Error('Saved federated credential does not match the expected Bot Service trust');
      } else await graph(`applications/${owned.objectId}/federatedIdentityCredentials`, 'POST', federation);
      config.botClientId = bot.clientId;
      config.oauthClientId = owned.clientId;
      config.federatedCredentialId = owned.federationId;
      config.oauthServiceProviderId = 'c00b44ab-5e16-c44c-af26-2fd5bc55eb18';
      const verified = await graph(`applications/${owned.objectId}/federatedIdentityCredentials`);
      if (!verified.value.some(item => item.name === federation.name && item.subject === federation.subject)) throw new Error('Federated credential readback did not match');
      const verifiedApp = await graph(`applications/${owned.objectId}`);
      if (!ssoResources.every(uri => verifiedApp.identifierUris?.includes(uri))) throw new Error('SSO Application ID URI readback did not match the target bot identities');
      await jsonFile(configFile, config);
      console.log(`Bot app: ${bot.clientId}; separate SSO app: ${owned.clientId}. Bot OAuth uses verified federated credentials with Teams SSO. Protected local credentials are not printed. No tenant-wide admin consent was granted; user consent may still be required.`);
      return;
    }
    validate(config);
    if (stage === 'package' || stage === 'install') {
      if (stage === 'install') approve(options, 'approve-install');
      const target = options.target ?? 'azure';
      const deployed = await load(target === 'local' ? path.join(local, 'deployment.local.json') : stateFile);
      await ownership(config);
      assertDeployment(config, deployed, target);
      const directory = await render(target === 'local' ? { ...config, websiteUrl: deployed.appUrl, privacyUrl: `${deployed.appUrl}/privacy`, termsOfUseUrl: `${deployed.appUrl}/terms` } : config, deployed, target);
      if (stage === 'install') {
        console.log(`Registering the selected Teams app${options['teams-only'] ? ' for Teams-only sideloading' : " and acquiring it in the signed-in ATK user's PERSONAL scope"}. Its Microsoft 365 tenant must be ${config.tenantId}.`);
        const app = await registerTeamsApp(config, directory, target);
        if (!options['teams-only']) {
          execute(executable('atk', env), ['install', '--file-path', path.join(local, `teams-m365.${target}.zip`), '--scope', 'Personal', '--interactive', 'false']);
        }
        const addUrl = new URL(`https://teams.microsoft.com/l/app/${app.id}`);
        for (const [key, value] of Object.entries({
          installAppPackage: 'true', webjoin: 'true', tenantId: config.tenantId, appTenantId: config.tenantId
        })) addUrl.searchParams.set(key, value);
        console.log(`Teams Developer Portal upload completed: ${app.name.short} ${app.version} (${app.id}). M365 personal acquisition: ${options['teams-only'] ? 'skipped' : 'completed'}. No tenant catalog publication or sharing was requested.`);
        console.log(`Client installation is pending: open ${addUrl} and complete Teams Add/Update and sign-in. Upload success does not verify the installed client version or authenticated chat.`);
        console.log(`If the link fails, use Teams Apps/Store > Manage your apps > Upload an app > Upload a custom app and select ${path.join(local, `teams-m365.${target}.zip`)}. Confirm ${app.name.short} version ${app.version} before Add/Update.`);
        return deployed;
      }
      console.log(`Generated .local/teams-m365.${target}.zip and connector definitions. Tenant installation is separate.`);
      return;
    }
    if (['local-bot', 'deploy', 'provision'].includes(stage)) approve(options, 'approve-azure');
    await context(config);
    await ownership(config);
    if (stage === 'local-bot' || (['deploy', 'provision'].includes(stage) && options.target === 'local')) {
      const publicUrl = await localOrigin(options);
      const health = await request(`${publicUrl}/health`, { redirect: 'error', signal: AbortSignal.timeout(15000) });
      if (!health.ok || (await health.json()).status !== 'ok') throw new Error('Start the local callback gateway and tunnel before provisioning its Azure Bot');
      secret('BOT_CLIENT_SECRET');
      const currentGroup = az(['group', 'list', '--subscription', config.subscriptionId]).find(group => group.name === config.resourceGroup);
      if (currentGroup && currentGroup.tags?.copilotHandover !== config.appName) throw new Error('Resource group is not sample-owned');
      if (!currentGroup) az(['group', 'create', '--subscription', config.subscriptionId, '--name', config.resourceGroup, '--location', config.location, '--tags', `copilotHandover=${config.appName}`]);
      const temporary = path.join(local, `local-bot.${randomUUID()}.parameters.json`);
      try {
        await jsonFile(temporary, {
          $schema: 'https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#', contentVersion: '1.0.0.0',
          parameters: Object.fromEntries(Object.entries({
            appName: config.appName, endpoint: `${publicUrl.replace(/\/$/, '')}/api/messages`,
            ...(config.displayName ? { displayName: config.displayName } : {}),
            botClientId: config.botClientId, oauthClientId: config.oauthClientId,
            federatedCredentialId: config.federatedCredentialId, serviceProviderId: config.oauthServiceProviderId
          }).map(([key, value]) => [key, { value }]))
        });
        const deploy = () => az(['deployment', 'group', 'create', '--subscription', config.subscriptionId, '--resource-group', config.resourceGroup,
          '--name', `${config.appName}-local-bot`, '--template-file', path.join(root, 'infra/local.bicep'), '--parameters', `@${temporary}`]);
        deploy();
        await verifyBotOAuth(config, `${config.appName}-local-bot`, config.botClientId, deploy);
      } finally { await rm(temporary, { force: true }); }
      const deployed = { appUrl: publicUrl, botClientId: config.botClientId, botName: `${config.appName}-local-bot`, oauthClientId: config.oauthClientId };
      await jsonFile(path.join(local, 'deployment.local.json'), deployed);
      await render({ ...config, websiteUrl: deployed.appUrl, privacyUrl: `${deployed.appUrl}/privacy`, termsOfUseUrl: `${deployed.appUrl}/terms` }, deployed, 'local');
      if (stage === 'deploy') await finishDeployment(config, deployed, 'local', options);
      console.log('Local-target Azure Bot endpoint and Teams/M365 ZIP prepared. Configure the imported connector host/connection and publish the Studio agent before a real handover test.');
      return deployed;
    }
    if (stage === 'deploy' || stage === 'provision') {
      if (stage === 'deploy') execute(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc')]);
      console.log(`Deploying sample-owned resources: ${config.subscriptionId} / ${config.resourceGroup} / ${config.appName}. B1 App Service and Storage incur charges. The mock support console is PUBLIC and has NO authentication; use synthetic data only.`);
      const currentGroup = az(['group', 'list', '--subscription', config.subscriptionId]).find(group => group.name === config.resourceGroup);
      if (currentGroup && currentGroup.tags?.copilotHandover !== config.appName) throw new Error('Resource group is not marked as owned by this sample. Choose a dedicated resource group.');
      if (!currentGroup) az(['group', 'create', '--subscription', config.subscriptionId, '--name', config.resourceGroup, '--location', config.location, '--tags', `copilotHandover=${config.appName}`]);
      const parameters = {
        $schema: 'https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#', contentVersion: '1.0.0.0',
        parameters: Object.fromEntries(Object.entries({
          appName: config.appName, location: config.location, studioEnvironmentId: config.environmentId,
          ...(config.displayName ? { displayName: config.displayName } : {}),
          studioSchemaName: config.schemaName, oauthClientId: config.oauthClientId,
          oauthServiceProviderId: config.oauthServiceProviderId, federatedCredentialId: config.federatedCredentialId
        }).map(([key, value]) => [key, { value }]))
      };
      const temporary = path.join(local, `parameters.${randomUUID()}.secret.json`);
      let result;
      try {
        await jsonFile(temporary, parameters);
        const deploy = () => az(['deployment', 'group', 'create', '--subscription', config.subscriptionId, '--resource-group', config.resourceGroup,
          '--name', `${config.appName}-infra`, '--template-file', path.join(root, 'infra/main.bicep'), '--parameters', `@${temporary}`]);
        result = deploy();
        await verifyBotOAuth(config, `${config.appName}-bot`, result.properties.outputs.botClientId.value, deploy);
      } finally { await rm(temporary, { force: true }); }
      const deployed = Object.fromEntries(Object.entries(result.properties.outputs).map(([name, data]) => [name, data.value]));
      assertDeployment(config, deployed, 'azure');
      const previous = existsSync(stateFile) ? await load(stateFile) : undefined;
      const defaultOrigin = `https://${config.appName}-app.azurewebsites.net`;
      // The managed identity's client ID is known only after its first ARM deployment.
      if (previous?.ssoRedirectPending || previous?.ssoConfigurationPending ||
          deployed.appUrl !== (previous?.appUrl ?? defaultOrigin) || deployed.botClientId !== previous?.botClientId) {
        deployed.ssoConfigurationPending = true;
      }
      await jsonFile(stateFile, deployed);
      if (deployed.ssoConfigurationPending) {
        for (const [field, suffix] of [['websiteUrl', ''], ['privacyUrl', '/privacy'], ['termsOfUseUrl', '/terms']]) {
          if (config[field] === `${defaultOrigin}${suffix}`) config[field] = `${deployed.appUrl}${suffix}`;
        }
        await jsonFile(configFile, config);
        if (!options['approve-identity']) throw new Error('Azure resolved a new bot identity or app hostname. Rerun with --approve-identity to reconcile the owned SSO resource URI before deploying code.');
        await stageMain('identity', options);
        delete deployed.ssoConfigurationPending;
        await jsonFile(stateFile, deployed);
      }
      if (stage === 'provision') {
        console.log(`Infrastructure reconciled: ${deployed.appUrl}. Run the deploy stage to upload code, check health and generate artifacts.`);
        return deployed;
      }
      const artifact = await packageApp();
      az(['webapp', 'deploy', '--subscription', config.subscriptionId, '--resource-group', config.resourceGroup,
        '--name', deployed.webAppName, '--src-path', artifact, '--type', 'zip', '--clean', 'true', '--restart', 'true', '--timeout', '600000']);
      await render(config, deployed);
      await finishDeployment(config, deployed, 'azure', options);
      console.log(`Azure relay uploaded: ${deployed.appUrl}\nSupport: ${deployed.appUrl}/support.html\nPackage: .local/teams-m365.azure.zip\nReview the generated checklist for remaining maker and consent steps. Deployment health is not proof of a real channel/handover test.`);
      return deployed;
    }
    throw new Error(`Unhandled stage: ${stage}`);
  }
  async function localOrigin(options) {
    const file = path.join(local, 'deployment.local.json');
    const saved = existsSync(file) ? (await load(file)).appUrl : undefined;
    return connectorOptions(['--url', options['public-url'] ?? env.PUBLIC_URL ?? env.HANDOVER_PUBLIC_URL ?? saved ?? '']).url;
  }
  async function verifyBotOAuth(config, botName, botClientId, redeploy) {
    guid(botClientId, 'deployed botClientId');
    const base = `https://management.azure.com/subscriptions/${config.subscriptionId}/resourceGroups/${config.resourceGroup}/providers/Microsoft.BotService/botServices/${botName}`;
    const connectionUrl = `${base}/connections/mcs?api-version=2022-09-15`;
    const read = url => az(['rest', '--method', 'get', '--url', url, '--subscription', config.subscriptionId]).properties;
    const bot = read(`${base}?api-version=2022-09-15`);
    if (bot.msaAppId !== botClientId) throw new Error('Azure Bot identity readback does not match the deployment');
    if (config.displayName && bot.displayName !== config.displayName) throw new Error('Azure Bot display name readback does not match configuration');
    let connection = read(connectionUrl);
    if (connection.serviceProviderId !== config.oauthServiceProviderId) {
      if (connection.serviceProviderId !== '30dd229c-58e3-4a48-bdfd-91ec48eb906c' ||
          config.oauthServiceProviderId !== 'c00b44ab-5e16-c44c-af26-2fd5bc55eb18') {
        throw new Error('Bot OAuth provider readback differs from configuration. Resolve the unexpected provider manually; no connection was deleted.');
      }
      // Bot Service ignores provider changes on PUT. Recreate only this owned legacy connection.
      console.warn('Migrating the sample-owned mcs OAuth connection from client secrets to federation. Existing users must sign in again.');
      az(['rest', '--method', 'delete', '--url', connectionUrl, '--subscription', config.subscriptionId], false);
      redeploy();
      connection = read(connectionUrl);
    }
    const parameters = new Map((connection.parameters ?? []).map(item => [item.key.toLowerCase(), item.value]));
    if (connection.serviceProviderId !== config.oauthServiceProviderId || connection.clientId !== config.oauthClientId ||
        connection.scopes !== 'https://api.powerplatform.com/.default' ||
        parameters.get('clientid') !== config.oauthClientId || parameters.get('tenantid') !== config.tenantId ||
        parameters.get('uniqueidentifier') !== config.federatedCredentialId ||
        parameters.get('tokenexchangeurl') !== `api://botid-${botClientId}`) {
      throw new Error('Bot OAuth readback does not match the configured SSO identity, federation, scope or token-exchange resource. Deployment is not ready.');
    }
  }
  function assertDeployment(config, deployed, target, verifySso = true) {
    const expected = `${config.appName}-${target === 'local' ? 'local-bot' : 'bot'}`;
    if (deployed.botName !== expected || (verifySso && deployed.oauthClientId && deployed.oauthClientId !== config.oauthClientId)) throw new Error('Saved deployment does not match the configured bot/SSO target');
    guid(deployed.botClientId, 'deployed botClientId');
    connectorOptions(['--url', deployed.appUrl]);
    if (target === 'local' && deployed.botClientId !== config.botClientId) throw new Error('Local bot identity does not match configuration');
    if (target === 'azure') {
      const host = new URL(deployed.appUrl).hostname, name = `${config.appName}-app`;
      if (deployed.webAppName !== name || !host.endsWith('.azurewebsites.net') || !(host === `${name}.azurewebsites.net` || host.startsWith(`${name}-`))) throw new Error('Unexpected Azure deployment output');
    }
  }
  async function finishDeployment(config, deployed, target, options) {
    let healthError;
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        await stageMain('smoke', { target, appUrl: deployed.appUrl });
        healthError = undefined;
        break;
      } catch (error) {
        healthError = error;
        if (attempt < 5) await (dependencies.sleep ?? (delay => new Promise(resolve => setTimeout(resolve, delay))))(5000);
      }
    }
    if (healthError) throw new Error(`Deployment exists, but readiness failed: ${healthError.message}. Fix the reported problem and rerun; resources and state are retained.`);
    if (options['approve-connector']) {
      const provision = dependencies.connector ?? provisionConnector;
      await provision(connectorOptions(['--url', deployed.appUrl, '--target', target, '--approve-connector']), { root: base });
    }
    if (options['approve-install']) await stageMain('install', { target, 'approve-install': true, 'teams-only': options['teams-only'] });
    const distribution = !options['approve-install'] ? 'not requested'
      : options['teams-only'] ? 'Teams upload completed; client installation pending'
      : 'Teams upload and M365 acquisition completed; client verification pending';
    console.log(`Deployment ready (${target}). Connector provisioning: ${options['approve-connector'] ? 'verified' : 'not requested'}. App package distribution: ${distribution}. Imported connector configuration, Studio publication and consent remain explicit; see generated/${target}/deployment-checklist.json.`);
  }
  return async (stage = 'doctor', args = []) => {
    const options = argumentsFor(stage, args);
    await mkdir(local, { recursive: true, mode: 0o700 });
    if (existsSync(path.join(local, 'secrets.env'))) {
      const values = parseEnv(await readFile(path.join(local, 'secrets.env'), 'utf8'));
      for (const [key, value] of Object.entries(values)) {
        env[key] ??= value;
        if (value && /SECRET|TOKEN|PASSWORD/i.test(key)) sensitive.push(value);
      }
    }
    return withLock(path.join(local, 'setup.lock'), () => stageMain(stage, options));
  };
}

export const main = createSetup();
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv[2] ?? 'doctor', process.argv.slice(3)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
