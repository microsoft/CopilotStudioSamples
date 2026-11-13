import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { readFileSync, writeFileSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { assertContext, assertOwned, connectorRows, options, pacExecutable, provision } from '../scripts/connector.mjs';

const tenantId = '11111111-1111-4111-8111-111111111111';
const environmentId = '22222222-2222-4222-8222-222222222222';
const auth = `Tenant Id: ${tenantId}\nEnvironment Id: ${environmentId}`;

test('connector options require explicit approval and a clean HTTPS origin', () => {
  assert.equal(options(['--url', 'https://relay.contoso.com']).approve, false);
  assert.equal(options(['--url', 'https://relay.contoso.com', '--approve-connector']).approve, true);
  for (const url of ['http://relay.contoso.com', 'https://secret@relay.contoso.com', 'https://relay.contoso.com/api/escalate', 'https://localhost', 'https://127.0.0.1']) {
    assert.throws(() => options(['--url', url]));
  }
  assert.throws(() => options(['--url', 'https://relay.contoso.com', '--target', '../other']));
  assert.equal(pacExecutable({ PAC_PATH: 'a path with spaces/pac' }), 'a path with spaces/pac');
});

test('connector context and recorded ownership reject mismatched environments/resources', () => {
  assertContext(auth, { tenantId, environmentId });
  assert.throws(() => assertContext(auth, { tenantId, environmentId: tenantId }), /does not match/);
  assert.throws(() => assertOwned({ info: { title: 'Handover escalation' } }, { ownership: 'own-marker' }), /ownership/);
  assertOwned({ info: { description: 'Sample ownership: own-marker' } }, { ownership: 'own-marker' });
  assert.deepEqual(connectorRows(`${environmentId} cr981_handover Handover escalation abc CustomConnector`),
    [{ id: environmentId, name: 'cr981_handover', displayName: 'Handover escalation abc' }]);
});

test('unapproved generation has no auth, network or cloud side effects; uncertain creates cannot repeat', async t => {
  const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.local');
  await mkdir(directory, { recursive: true });
  const root = await mkdtemp(path.join(directory, 'connector-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, '.local'));
  await writeFile(path.join(root, '.local/config.json'), JSON.stringify({ tenantId, environmentId }));
  const dependencies = { root, run: () => { throw new Error('unexpected CLI'); }, fetch: () => { throw new Error('unexpected network'); } };
  const settings = options(['--url', 'https://relay.contoso.com']);
  const result = await provision(settings, dependencies);
  assert.equal(result.status, 'generated');
  const definition = JSON.parse(await readFile(result.definitionFile, 'utf8'));
  assert.deepEqual(definition.security, []);
  assert.equal(definition.securityDefinitions, undefined);
  assert.deepEqual(definition.paths['/api/escalate'].post.parameters[0].schema.required, ['reason', 'summary']);
  await writeFile(path.join(root, '.local/connector.json'), JSON.stringify({ tenantId, environmentId, phase: 'creating' }));
  await assert.rejects(() => provision({ ...settings, approve: true }, dependencies), /uncertain outcome/);
});

test('provisioning persists the exact connector ID, updates only owned resources, and verifies no-auth properties', async t => {
  const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.local');
  await mkdir(directory, { recursive: true });
  const root = await mkdtemp(path.join(directory, 'connector-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, '.local'));
  await writeFile(path.join(root, '.local/config.json'), JSON.stringify({ tenantId, environmentId }));
  const id = '11111111-2222-3333-4444-555555555555';
  let deployed, properties, creates = 0, updates = 0;
  const execute = args => {
    if (args[0] === 'auth') return auth;
    assert.equal(args[args.indexOf('--environment') + 1], environmentId);
    if (args[1] === 'list') return deployed ? `${id} new_handover ${deployed.info.title} CustomConnector` : '';
    if (args[1] === 'download') {
      assert.equal(args[args.indexOf('--connector-id') + 1], id);
      const output = args[args.indexOf('--outputDirectory') + 1];
      writeFileSync(path.join(output, 'apiDefinition.json'), JSON.stringify(deployed));
      writeFileSync(path.join(output, 'apiProperties.json'), JSON.stringify(properties));
      return '';
    }
    if (args[1] === 'create') creates++;
    else if (args[1] === 'update') {
      updates++;
      assert.equal(args[args.indexOf('--connector-id') + 1], id);
    } else throw new Error('Unexpected CLI command');
    deployed = JSON.parse(readFileSync(args[args.indexOf('--api-definition-file') + 1], 'utf8'));
    properties = JSON.parse(readFileSync(args[args.indexOf('--api-properties-file') + 1], 'utf8'));
    return '';
  };
  const dependencies = { root, run: execute, fetch: async () => ({ ok: true }) };
  const settings = options(['--url', 'https://relay.contoso.com', '--approve-connector']);
  const created = await provision(settings, dependencies);
  assert.equal(created.connectorId, id);
  assert.equal(created.status, 'verified');
  const updated = await provision(settings, dependencies);
  assert.equal(updated.connectorId, id);
  assert.equal(creates, 1);
  assert.equal(updates, 1);
  deployed.info.description = 'Another owner';
  await assert.rejects(() => provision(settings, dependencies), /ownership marker/);
  assert.equal(updates, 1);
});

test('local and Azure connector reruns cannot replace each other when the local tunnel changes', async t => {
  const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.local');
  await mkdir(directory, { recursive: true });
  const root = await mkdtemp(path.join(directory, 'connector-target-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, '.local'));
  await writeFile(path.join(root, '.local/config.json'), JSON.stringify({ tenantId, environmentId }));
  const connectors = new Map();
  const run = args => {
    if (args[0] === 'auth') return auth;
    if (args[1] === 'list') return [...connectors].map(([id, value]) => `${id} sample_${id} ${value.definition.info.title} CustomConnector`).join('\n');
    const id = args.includes('--connector-id') ? args[args.indexOf('--connector-id') + 1] : randomUUID();
    if (args[1] === 'download') {
      const output = args[args.indexOf('--outputDirectory') + 1], value = connectors.get(id);
      writeFileSync(path.join(output, 'apiDefinition.json'), JSON.stringify(value.definition));
      writeFileSync(path.join(output, 'apiProperties.json'), JSON.stringify(value.properties));
    } else {
      assert.ok(['create', 'update'].includes(args[1]));
      connectors.set(id, {
        definition: JSON.parse(readFileSync(args[args.indexOf('--api-definition-file') + 1], 'utf8')),
        properties: JSON.parse(readFileSync(args[args.indexOf('--api-properties-file') + 1], 'utf8'))
      });
    }
    return '';
  };
  const dependencies = { root, run, fetch: async () => ({ ok: true }) };
  const configure = (target, url) => provision(options(['--target', target, '--url', url, '--approve-connector']), dependencies);
  const local = await configure('local', 'https://local.contoso.test');
  const azure = await configure('azure', 'https://azure.contoso.test');
  const changed = await configure('local', 'https://new-local.contoso.test');
  assert.notEqual(local.connectorId, azure.connectorId);
  assert.equal(changed.connectorId, local.connectorId);
  assert.equal(connectors.size, 2);
  assert.equal(connectors.get(azure.connectorId).definition.host, 'azure.contoso.test');
  assert.equal(connectors.get(local.connectorId).definition.host, 'new-local.contoso.test');
});
