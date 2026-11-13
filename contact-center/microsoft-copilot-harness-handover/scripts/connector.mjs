import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import spawn from 'cross-spawn';
import { connector, connectorProperties } from './assets.mjs';
import { save, withLock } from './state.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const guidPattern = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
const load = async file => JSON.parse(await readFile(file, 'utf8'));

export function options(args) {
  const result = { approve: false, target: 'local' };
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--approve-connector') result.approve = true;
    else if (arg === '--url' || arg === '--target') {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value`);
      result[arg.slice(2)] = value;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!['local', 'azure'].includes(result.target)) throw new Error('--target must be local or azure');
  const url = new URL(result.url);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash || url.pathname !== '/'
      || !url.hostname.includes('.') || /^(localhost|127\.|0\.|192\.168\.|10\.)/i.test(url.hostname)) {
    throw new Error('--url must be the verified stable public HTTPS origin, without credentials, port, path or query');
  }
  result.url = url.origin;
  return result;
}

export function assertContext(output, config) {
  for (const [label, expected] of [['Tenant Id', config.tenantId], ['Environment Id', config.environmentId]]) {
    if (!guidPattern.test(expected ?? '')) throw new Error(`Invalid configured ${label}`);
    const value = output.match(new RegExp(`^${label}:\\s*([a-f\\d-]+)\\s*$`, 'im'))?.[1];
    if (value?.toLowerCase() !== expected.toLowerCase()) {
      throw new Error(`pac auth who ${label} does not match .local/config.json. Select the intended cached profile before retrying; no cloud writes performed.`);
    }
  }
}

export function connectorRows(output) {
  return output.split(/\r?\n/).flatMap(line => {
    const match = line.match(/^([a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12})\s+(\S+)\s+(.+?)\s+CustomConnector\s*$/i);
    return match ? [{ id: match[1].toLowerCase(), name: match[2], displayName: match[3].trim() }] : [];
  });
}

export function pacExecutable(env = process.env) {
  if (env.PAC_PATH) return env.PAC_PATH;
  const local = path.join(root, '.local', 'tools', process.platform === 'win32' ? 'pac.exe' : 'pac');
  return existsSync(local) ? local : 'pac';
}

function run(args) {
  const dotnetRoot = path.join(homedir(), '.dotnet');
  const result = spawn.sync(pacExecutable(), args, {
    cwd: root, shell: false, encoding: 'utf8', timeout: 120_000, maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, ...(!process.env.DOTNET_ROOT && existsSync(dotnetRoot) ? { DOTNET_ROOT: dotnetRoot } : {}) }
  });
  if (result.error || result.status !== 0 || /^Error:/im.test(result.stdout ?? '')) {
    throw new Error(`pac ${args.slice(0, 2).join(' ')} failed: ${[result.error?.message, result.stderr, result.stdout].filter(Boolean).join('\n').slice(0, 2500)}`);
  }
  return result.stdout;
}

async function downloadedArtifacts(directory) {
  let definition, properties;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const value = await load(path.join(directory, entry.name));
    if (value.swagger === '2.0') definition = value;
    if (value.properties?.connectionParameters) properties = value;
  }
  if (!definition || !properties) throw new Error('pac download did not produce connector definition/properties; ownership cannot be verified');
  return { definition, properties };
}

export function assertOwned(definition, state) {
  if (!state.ownership || definition.info?.description !== `Sample ownership: ${state.ownership}`) {
    throw new Error('Downloaded connector ownership marker does not match local state; refusing to overwrite it');
  }
}

export async function provision(settings, dependencies = {}) {
  const file = path.join(dependencies.root ?? root, '.local', `connector.${settings.target}.lock`);
  return withLock(file, () => provisionLocked(settings, dependencies));
}

async function provisionLocked(settings, dependencies) {
  const base = dependencies.root ?? root;
  const execute = dependencies.run ?? run;
  const request = dependencies.fetch ?? fetch;
  const local = path.join(base, '.local');
  const config = await load(path.join(local, 'config.json'));
  for (const field of ['tenantId', 'environmentId']) {
    if (!guidPattern.test(config[field] ?? '')) throw new Error(`Invalid configured ${field}`);
  }
  const stateFile = path.join(local, `connector.${settings.target}.json`);
  const legacyFile = path.join(local, 'connector.json');
  if (!existsSync(stateFile) && existsSync(legacyFile)) {
    const legacy = await load(legacyFile);
    if (legacy.phase === 'creating') throw new Error('Legacy connector creation has an uncertain outcome. Reconcile .local/connector.json before continuing.');
    if (legacy.appUrl === settings.url) {
      if (legacy.environmentId !== config.environmentId || legacy.tenantId !== config.tenantId) throw new Error('Legacy connector belongs to another tenant/environment');
      await save(stateFile, legacy);
    } else {
      const other = path.join(local, settings.target === 'local' ? 'deployment.json' : 'deployment.local.json');
      if (!existsSync(other) || (await load(other)).appUrl !== legacy.appUrl) throw new Error('Legacy connector target is ambiguous. Reconcile connector.json into the correct target-specific record before changing its URL; no duplicate will be created.');
    }
  }
  let state = existsSync(stateFile) ? await load(stateFile) : undefined;
  if (state && (state.environmentId !== config.environmentId || state.tenantId !== config.tenantId)) {
    throw new Error('Connector state belongs to another tenant/environment; refusing to reuse it');
  }
  if (state?.phase === 'creating') {
    throw new Error(`A previous create has an uncertain outcome. Reconcile ${stateFile} manually; automatic duplicate creation is disabled.`);
  }
  if (state?.connectorId && (!guidPattern.test(state.connectorId) || !state.ownership)) throw new Error('Invalid connector ownership state');
  state ??= {
    tenantId: config.tenantId, environmentId: config.environmentId, ownership: randomUUID()
  };
  state.displayName ??= `Handover escalation ${state.ownership.slice(0, 8)}`;
  const definition = connector(new URL(settings.url).hostname, state);
  const directory = path.join(local, 'generated', settings.target);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const definitionFile = path.join(directory, 'escalation.swagger.json');
  const propertiesFile = path.join(directory, 'apiProperties.json');
  await save(definitionFile, definition);
  await save(propertiesFile, connectorProperties());
  if (!settings.approve) {
    return { status: 'generated', definitionFile, propertiesFile, message: 'No cloud writes. Rerun with --approve-connector to create/update the sample-owned connector.' };
  }
  assertContext(execute(['auth', 'who']), config);
  const response = await request(`${settings.url}/health`, { signal: AbortSignal.timeout(15_000), redirect: 'error' });
  if (!response.ok) throw new Error(`Relay health check failed (${response.status}); no cloud writes performed`);
  const environment = ['--environment', config.environmentId];
  const download = async id => {
    const directory = path.join(local, 'connector-check', randomUUID());
    await mkdir(directory, { recursive: true, mode: 0o700 });
    try {
      execute(['connector', 'download', ...environment, '--connector-id', id, '--outputDirectory', directory]);
      return await downloadedArtifacts(directory);
    } finally { await rm(directory, { recursive: true, force: true }); }
  };
  const before = connectorRows(execute(['connector', 'list', ...environment]));
  if (state.connectorId) {
    const existing = before.find(row => row.id === state.connectorId.toLowerCase());
    if (!existing) throw new Error('Recorded connector no longer exists in the configured environment; refusing to create a replacement automatically');
    assertOwned((await download(state.connectorId)).definition, state);
  } else {
    state.phase = 'creating';
    await save(stateFile, state);
  }
  execute(['connector', state.connectorId ? 'update' : 'create', ...environment,
    ...(state.connectorId ? ['--connector-id', state.connectorId] : []),
    '--api-definition-file', definitionFile, '--api-properties-file', propertiesFile]);
  const after = connectorRows(execute(['connector', 'list', ...environment]));
  if (!state.connectorId) {
    const created = after.filter(row => !before.some(old => old.id === row.id) && row.displayName === state.displayName);
    if (created.length !== 1) throw new Error(`Cannot uniquely identify the newly created connector. Reconcile ${stateFile} before retrying; automatic duplicate creation is disabled.`);
    state.connectorId = created[0].id;
    state.name = created[0].name;
    state.phase = 'created';
    await save(stateFile, state);
  }
  const { definition: deployed, properties } = await download(state.connectorId);
  assertOwned(deployed, state);
  const operation = deployed.paths?.['/api/escalate']?.post;
  const inputs = operation?.parameters?.find(parameter => parameter.in === 'body')?.schema?.properties;
  if (deployed.host !== definition.host || Object.keys(deployed.securityDefinitions ?? {}).length
      || (deployed.security ?? []).length || Object.keys(properties.properties.connectionParameters).length
      || operation?.operationId !== 'Escalate' || Object.keys(inputs ?? {}).sort().join(',') !== 'conversationId,reason,summary') {
    throw new Error('Downloaded connector does not match the requested NO AUTH escalation definition');
  }
  state = { ...state, phase: 'verified', appUrl: settings.url, verifiedAt: new Date().toISOString() };
  await save(stateFile, state);
  return { status: 'verified', ...state, definitionFile, propertiesFile };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(await provision(options(process.argv.slice(2))), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
