import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import spawn from 'cross-spawn';
import { root, executable, run, validate, main } from './setup.mjs';
import { gateway, tunnelUrl } from './gateway.mjs';
import { save } from './state.mjs';

// Only the callback gateway is tunneled. The customer/support UI never is.
const args = process.argv.slice(2);
if (args.some(arg => !['--approve-azure', '--approve-identity'].includes(arg))) throw new Error('Use only --approve-azure and optionally --approve-identity');
if (!args.includes('--approve-azure')) throw new Error('Review the local target, then rerun with --approve-azure before creating a tunnel or changing Azure resources.');
if (args.includes('--approve-identity')) await main('identity', ['--approve-identity']);
const config = validate(JSON.parse(await readFile(path.join(root, '.local/config.json'), 'utf8')));
process.loadEnvFile(path.join(root, '.local/secrets.env'));
if (!process.env.BOT_CLIENT_SECRET) throw new Error('BOT_CLIENT_SECRET is required before starting the relay');
run(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc')]);
const children = [];
const proxy = gateway(3978);
let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  proxy.close();
  process.exitCode = code;
}
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
const env = {
  ...process.env, MODE: 'studio', HOSTING_TARGET: 'local', PORT: '3978',
  DEBUG: process.env.DEBUG || 'agents:cloud-adapter:error',
  STUDIO_ENVIRONMENT_ID: config.environmentId, STUDIO_SCHEMA_NAME: config.schemaName,
  connections__serviceConnection__settings__authType: 'ClientSecret',
  connections__serviceConnection__settings__clientId: config.botClientId,
  connections__serviceConnection__settings__clientSecret: process.env.BOT_CLIENT_SECRET,
  connections__serviceConnection__settings__tenantId: config.tenantId,
  connectionsMap__0__connection: 'serviceConnection', connectionsMap__0__serviceUrl: '*',
  connectionsMap__0__audience: config.botClientId,
  AgentApplication__UserAuthorization__Handlers__mcs__Settings__azureBotOAuthConnectionName: 'mcs',
  AgentApplication__UserAuthorization__Handlers__mcs__Settings__enableSso: 'true',
  OutboundHostValidator__Enabled: 'true', OutboundHostValidator__IncludeDefaultMicrosoftHosts: 'true',
  CloudAdapterOptions__validateServiceUrl: 'true'
};
try {
  const relay = spawn(process.execPath, ['dist/server.js'], { cwd: root, env, stdio: 'inherit' });
  children.push(relay);
  relay.once('error', error => { console.error(error.message); stop(1); });
  relay.on('exit', code => { if (!stopping) stop(code || 1); });
  await new Promise((resolve, reject) => { proxy.once('error', reject); proxy.listen(3979, '127.0.0.1', resolve); });
  let url = process.env.PUBLIC_URL;
  if (!url) {
    run(executable('devtunnel'), ['--version']);
    const tunnelFile = path.join(root, '.local/tunnel.json');
    let id;
    if (existsSync(tunnelFile)) {
      const saved = JSON.parse(await readFile(tunnelFile, 'utf8'));
      if (saved.phase === 'creating') throw new Error('Tunnel creation is uncertain. Inspect the devtunnel account and reconcile .local/tunnel.json before retrying; no duplicate tunnel will be created.');
      id = saved.id;
    }
    else {
      await save(tunnelFile, { phase: 'creating' });
      const created = run(executable('devtunnel'), ['create', '--allow-anonymous', '--description', 'Copilot Studio handover callback gateway', '--labels', 'copilot-studio-handover', '--json'], true);
      id = created.tunnel?.tunnelId;
      if (typeof id !== 'string' || !/^[a-z0-9-]+\.[a-z0-9-]+$/.test(id)) throw new Error('Tunnel CLI did not return a qualified tunnel ID');
      await save(tunnelFile, { id });
    }
    if (typeof id !== 'string' || !/^[a-z0-9-]+\.[a-z0-9-]+$/.test(id)) throw new Error('Saved tunnel ID is invalid');
    const existing = run(executable('devtunnel'), ['show', id, '--json'], true);
    if (!existing.tunnel?.labels?.includes('copilot-studio-handover')) throw new Error('Saved tunnel is not marked as sample-owned');
    const ports = run(executable('devtunnel'), ['port', 'list', id, '--json'], true);
    if (ports.warning === `No ports found for tunnel ${id.split('.')[0]}.` || (Array.isArray(ports.ports) && !ports.ports.some(port => port.portNumber === 3979))) {
      run(executable('devtunnel'), ['port', 'create', id, '-p', '3979', '--protocol', 'http', '--json'], true);
    } else if (!Array.isArray(ports.ports)) throw new Error('Tunnel CLI returned an unexpected port list');
    const tunnel = spawn(executable('devtunnel'), ['host', id], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    children.push(tunnel);
    url = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Tunnel was not ready. Run devtunnel user login, then retry.')), 60000);
      let output = '';
      const observe = chunk => {
        output = (output + chunk.toString()).slice(-16000);
        const found = tunnelUrl(output, 3979);
        if (found) { clearTimeout(timer); resolve(found); }
      };
      tunnel.stdout.on('data', observe); tunnel.stderr.on('data', observe);
      tunnel.once('error', error => { clearTimeout(timer); reject(error); });
      tunnel.once('exit', () => {
        clearTimeout(timer);
        const detail = output.split('\n').find(line => /^(Tunnel service error:|Error:)/i.test(line));
        reject(new Error(detail || 'Tunnel exited. Verify devtunnel authentication and retry.'));
        if (!stopping) stop(1);
      });
    });
  }
  const health = await fetch(new URL('/health', url), { redirect: 'manual', signal: AbortSignal.timeout(20000) });
  if (!health.ok || (await health.json()).status !== 'ok') throw new Error('Tunnel did not reach the local relay health endpoint');
  // Use the same provisioning/package entry point as the Azure-hosted target.
  await main('local-bot', ['--public-url', url, '--approve-azure']);
  console.log(`Callbacks: ${url}\nPrivate console: http://127.0.0.1:3978/support.html\nKeep this command running; Ctrl+C stops the relay and tunnel.`);
} catch (error) {
  console.error(error.message);
  stop(1);
}
