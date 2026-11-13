import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { unzipSync, strFromU8 } from 'fflate';
import { appPackage, connector, connectorProperties, hookWorkflow } from '../scripts/assets.mjs';
import { validate, executable, run, teamsSsoApi } from '../scripts/setup.mjs';
import { gateway, tunnelUrl } from '../scripts/gateway.mjs';
import http from 'node:http';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { parseEnv } from 'node:util';
import { parse } from 'yaml';
import { createSetup, root, argumentsFor } from '../scripts/setup.mjs';
import { withLock } from '../scripts/state.mjs';

const config = {
  tenantId: '11111111-1111-4111-8111-111111111111', subscriptionId: '22222222-2222-4222-8222-222222222222',
  environmentId: '33333333-3333-4333-8333-333333333333', oauthClientId: '44444444-4444-4444-8444-444444444444',
  botClientId: '77777777-7777-4777-8777-777777777777', federatedCredentialId: '88888888-8888-4888-8888-888888888888',
  oauthServiceProviderId: '55555555-5555-4555-8555-555555555555',
  schemaName: 'sample_handover', appName: 'handover-test', resourceGroup: 'handover-test', location: 'eastus',
  developerName: 'Contoso', websiteUrl: 'https://contoso.test', privacyUrl: 'https://contoso.test/privacy', termsOfUseUrl: 'https://contoso.test/terms'
};
test('solution packages preserve the scoped hook, workflow and registered connector bindings', () => {
  const agent = unzipSync(readFileSync(path.join(root, 'solution/CopilotStudioHandover_1_0_0_0.zip')));
  const connectorPackage = unzipSync(readFileSync(path.join(root, 'solution/CopilotStudioHandoverConnector_1_0_0_0.zip')));
  const toolPath = 'botcomponents/cpshnd_handover.tool.Escalate/data';
  const hookPath = 'botcomponents/cpshnd_handover.hook.InjectConversationId/data';
  const tool = parse(strFromU8(agent[toolPath]));
  const hook = parse(strFromU8(agent[hookPath]));
  for (const file of [toolPath, hookPath]) {
    assert.deepEqual(parse(strFromU8(agent[file])), parse(readFileSync(path.join(root, 'sourcecode/agent', file), 'utf8')));
  }
  assert.deepEqual(hook.event.filteredTools, ['cpshnd_handover.tool.Escalate']);
  const customizations = strFromU8(agent['customizations.xml']);
  const referenceName = /<connectionreference connectionreferencelogicalname="([^"]+)"/.exec(customizations)?.[1];
  const connectorApi = /<connectorid>(\/providers\/Microsoft\.PowerApps\/apis\/[^<]+)<\/connectorid>/.exec(customizations)?.[1];
  assert.ok(referenceName && connectorApi, 'the exported agent must include its connector reference');
  assert.equal(tool.connectionReference, referenceName);
  assert.equal(tool.connectorId, connectorApi, 'tool and connection reference must use the same registered connector');
  const flowPath = Object.keys(agent).find(file =>
    file.startsWith('Workflows/') && file.toLowerCase().includes(hook.action.workflowId) && file.endsWith('.json'));
  assert.ok(flowPath, 'the hook must point to a workflow included in the agent package');
  const workflow = JSON.parse(strFromU8(agent[flowPath]));
  assert.deepEqual(workflow, JSON.parse(readFileSync(path.join(root, 'sourcecode/agent', flowPath), 'utf8')));
  const definition = workflow.properties.definition;
  const response = definition.actions.Respond_to_the_agent;
  const node = definition.triggers.manual.metadata.associatedData.graph.nodes.find(item => item.id === response.metadata.nodeId);
  assert.ok(node, 'the response must be editable in the workflow designer');
  assert.deepEqual(response.inputs.body, node.data.config.parameters.body);
  assert.match(response.inputs.body.modifiedParameters, /body\/metadata\/conversationId/);
  assert.match(response.inputs.body.modifiedParameters, /body\/parameters\/body/);
  const connectorPath = Object.keys(connectorPackage).find(file => file.endsWith('_openapidefinition.json'));
  assert.ok(connectorPath);
  const connector = JSON.parse(strFromU8(connectorPackage[connectorPath]));
  assert.equal(tool.operationId, connector.paths['/api/escalate'].post.operationId);
  assert.equal(connector.host, 'relay.example.com', 'the distributed connector must not target a developer tunnel');
  assert.deepEqual(connector.security, []);
  assert.ok(!Object.keys(agent).some(file => file.startsWith('Connector/')), 'import the connector before the agent connection reference');
  assert.ok(!Object.keys(connectorPackage).some(file => /^(bots|botcomponents|Workflows)\//.test(file)), 'the prerequisite must contain only the connector');
});
test('deployment validates targets and real HTTPS policy links without requiring a console identity', () => {
  validate(config);
  assert.throws(() => validate({ ...config, tenantId: 'invalid' }), /GUID/);
  assert.throws(() => validate({ ...config, appName: '../other' }), /appName/);
  assert.throws(() => validate({ ...config, displayName: ' '.repeat(5) }), /displayName/);
  assert.throws(() => validate({ ...config, displayName: 'x'.repeat(31) }), /displayName/);
  assert.throws(() => validate({ ...config, privacyUrl: 'http://contoso.test/privacy' }), /HTTPS/);
  assert.throws(() => validate({ ...config, teamsAppIds: { local: 'invalid' } }), /GUID/);
  assert.throws(() => validate({ ...config, teamsAppIds: { local: config.botClientId, azure: config.botClientId } }), /must differ/);
});
test('Teams SSO adds only its own scope to trusted clients and preserves existing API configuration', () => {
  const scope = { id: config.oauthServiceProviderId, value: 'defaultScope', isEnabled: true };
  const existing = {
    requestedAccessTokenVersion: 1, knownClientApplications: [config.oauthClientId],
    oauth2PermissionScopes: [{ id: config.environmentId, value: 'other' }],
    preAuthorizedApplications: [
      { appId: '1fec8e78-bce4-4aaf-ab1b-5451cc387264', delegatedPermissionIds: [config.environmentId] },
      { appId: config.subscriptionId, delegatedPermissionIds: [config.environmentId] }
    ]
  };
  const before = structuredClone(existing);
  const api = teamsSsoApi(existing, scope);
  assert.equal(api.requestedAccessTokenVersion, 2);
  assert.deepEqual(api.knownClientApplications, existing.knownClientApplications);
  assert.deepEqual(api.oauth2PermissionScopes, [...existing.oauth2PermissionScopes, scope]);
  assert.deepEqual(api.preAuthorizedApplications, [
    { ...existing.preAuthorizedApplications[0], delegatedPermissionIds: [config.environmentId, scope.id] },
    existing.preAuthorizedApplications[1],
    { appId: '5e3ce6c0-2b1f-4285-8d4b-75ee78787346', delegatedPermissionIds: [scope.id] }
  ]);
  assert.deepEqual(existing, before, 'configuration generation does not mutate the readback');
  assert.deepEqual(teamsSsoApi(api, scope), api, 'reconciling SSO is idempotent');
  assert.equal(teamsSsoApi({}, scope).preAuthorizedApplications.length, 2);
});
test('Teams SSO refuses to replace a scope whose ID differs from the saved ownership record', () => {
  assert.throws(() => teamsSsoApi({
    oauth2PermissionScopes: [{ id: config.environmentId, value: 'defaultScope' }]
  }, { id: config.oauthServiceProviderId, value: 'defaultScope' }), /ownership mismatch/);
});
test('generated personal-chat package contains valid root manifest/icons, no configuration or credentials', () => {
  const zip = unzipSync(appPackage(config, { appUrl: 'https://relay.azurewebsites.net', botClientId: config.subscriptionId }));
  assert.deepEqual(Object.keys(zip).sort(), ['color.png', 'manifest.json', 'outline.png']);
  const manifest = JSON.parse(strFromU8(zip['manifest.json']));
  assert.deepEqual(manifest.bots[0].scopes, ['personal']);
  assert.equal(manifest.bots[0].botId, manifest.copilotAgents.customEngineAgents[0].id);
  assert.equal(manifest.webApplicationInfo.id, config.oauthClientId);
  assert.equal(manifest.webApplicationInfo.resource, `api://botid-${manifest.bots[0].botId}`);
  assert.equal(Buffer.from(zip['color.png']).readUInt32BE(16), 192);
  assert.equal(Buffer.from(zip['outline.png']).readUInt32BE(16), 32);
  assert.doesNotMatch(strFromU8(zip['manifest.json']), /clientSecret|tenantId/);
});
test('connector keeps maker-injected inputs out of required model arguments and workflow preserves the hook payload', () => {
  const operation = connector('relay.azurewebsites.net').paths['/api/escalate'].post;
  assert.deepEqual(operation.parameters[0].schema.required, ['reason', 'summary']);
  assert.deepEqual(connector('relay.azurewebsites.net').security, []);
  assert.equal(connector('relay.azurewebsites.net').securityDefinitions, undefined);
  assert.deepEqual(Object.keys(operation.parameters[0].schema.properties).sort(), ['conversationId', 'reason', 'summary']);
  assert.deepEqual(connectorProperties().properties.connectionParameters, {});
  const flow = hookWorkflow();
  const definition = flow.properties.definition;
  assert.equal(definition.triggers.manual.kind, 'Skills');
  assert.deepEqual(Object.keys(definition.actions), ['Respond_to_the_agent'], 'the hook returns its override without HTTP/helper actions');
  const expression = definition.actions.Respond_to_the_agent.inputs.body.modifiedParameters;
  const override = "json(concat('{\"conversationId\":\"', triggerOutputs()?['body/metadata/conversationId'], '\"}'))";
  assert.ok(expression.includes(`union(triggerOutputs()?['body/parameters'], ${override})`), 'flat arguments preserve all original fields');
  assert.ok(expression.includes(`json(concat('{"body":', string(union(triggerOutputs()?['body/parameters/body'], ${override})), '}'))`), 'wrapped arguments receive the ID inside their body object');
  assert.doesNotMatch(expression, /setProperty|json\(triggerOutputs\(\)\?\['body\/parameters\/body'\]\)/, 'the designer-compatible override must not parse an already-object body');
  assert.doesNotMatch(JSON.stringify(flow), /handoverToken|x-api-key|https:\/\/relay/);
});
test('hook response is bound in both the executable definition and the designer graph', () => {
  const definition = hookWorkflow().properties.definition;
  const response = definition.actions.Respond_to_the_agent;
  const graph = definition.triggers.manual.metadata.associatedData.graph;
  const node = graph.nodes.find(node => node.id === response.metadata.nodeId);
  assert.equal(node.data.config.operationId, 'response');
  assert.deepEqual(
    definition.triggers.manual.metadata.associatedData.nodeActionMapping[node.id],
    ['Respond_to_the_agent']
  );
  assert.deepEqual(node.data.config.parameters, response.inputs);
  assert.ok(graph.edges.some(edge => edge.source === 'start' && edge.target === node.id));
  assert.deepEqual(
    graph.nodes.find(node => node.id === 'start').data.config.connector.inputs.schema,
    definition.triggers.manual.inputs.schema
  );
  node.data.config.parameters.body.modifiedParameters = 'designer edit';
  assert.notEqual(response.inputs.body.modifiedParameters, 'designer edit', 'graph and definition are serialized separately');
});
test('process runner preserves arguments with spaces and reports failed subprocesses on every OS', () => {
  const value = 'a path with spaces and "quotes"';
  assert.equal(run(process.execPath, ['-e', 'process.stdout.write(process.argv[1])', value]), value);
  assert.throws(() => run(process.execPath, ['-e', 'process.stderr.write("specific failure");process.exit(7)']), /specific failure/);
  assert.equal(executable('atk', { ATK_PATH: 'a path with spaces/atk' }), 'a path with spaces/atk');
});
test('local tunnel gateway exposes callbacks but cannot reach the support console or its API', async t => {
  const upstream = http.createServer((request, response) => {
    response.writeHead(request.url === '/api/messages' ? 401 : 200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ path: request.url }));
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  const proxy = gateway(upstream.address().port);
  await new Promise(resolve => proxy.listen(0, '127.0.0.1', resolve));
  t.after(() => { proxy.close(); upstream.close(); });
  const base = `http://127.0.0.1:${proxy.address().port}`;
  assert.equal((await fetch(`${base}/api/messages`, { method: 'POST' })).status, 401);
  assert.equal((await fetch(`${base}/api/escalate`, { method: 'POST' })).status, 200);
  assert.equal((await fetch(`${base}/health`)).status, 200);
  for (const route of ['/support.html', '/app.js', '/api/support', '/api/customer', '/api/support/id/close', '/api/hooks/pretool']) {
    assert.equal((await fetch(`${base}${route}`)).status, 404, route);
    assert.equal((await fetch(`${base}${route}`, { method: 'POST' })).status, 404, route);
  }
});
test('tunnel discovery selects the port-specific callback URL, not a port-less or inspection URL', () => {
  assert.equal(tunnelUrl('Hosting port 3979 at https://example.usw2.devtunnels.ms:3979/, https://example-3979.usw2.devtunnels.ms/ and inspect at https://example-3979-inspect.usw2.devtunnels.ms/', 3979), 'https://example-3979.usw2.devtunnels.ms');
  assert.equal(tunnelUrl('Hosting port 1234 at https://example-1234.usw2.devtunnels.ms/', 3979), undefined);
});

async function deploymentFixture(t) {
  await mkdir(path.join(root, '.local'), { recursive: true });
  const base = await mkdtemp(path.join(root, '.local', 'deployment test-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const local = path.join(base, '.local');
  await mkdir(local);
  const save = (name, value) => writeFile(path.join(local, name), JSON.stringify(value));
  await save('config.json', config);
  const apps = new Map(), principals = new Map(), credentials = new Map();
  const counts = { applications: 0, passwords: 0, federations: 0, uploads: 0, groups: 0, infrastructure: 0, registrations: 0, installs: 0, connectors: 0 };
  const env = { BOT_CLIENT_SECRET: 'test-bot-secret' };
  const state = { group: undefined, failCreate: false, failPassword: false, failUpload: false, health: true, tenant: config.tenantId };
  const deployed = { appUrl: `https://${config.appName}-app.azurewebsites.net`, webAppName: `${config.appName}-app`, botName: `${config.appName}-bot`, botClientId: config.subscriptionId, oauthClientId: config.oauthClientId };
  const run = (command, args, json, options) => {
    if (command === process.execPath) return '';
    if (command === 'atk') {
      if (args[0] === 'provision') {
        assert.deepEqual(args.slice(0, 2), ['provision', '--folder']);
        assert.deepEqual(args.slice(3), ['--env', 'install', '--interactive', 'false']);
        const workflow = parse(readFileSync(path.join(args[2], 'm365agents.yml'), 'utf8'));
        const environmentFile = path.join(args[2], 'env/.env.install');
        const values = parseEnv(readFileSync(environmentFile, 'utf8'));
        assert.equal(workflow.publish, undefined);
        assert.equal(workflow.share, undefined);
        assert.deepEqual(workflow.provision.map(step => step.uses), ['teamsApp/create', 'teamsApp/update']);
        assert.equal(workflow.provision[0].writeToEnvironmentFile.teamsAppId, 'TEAMS_APP_ID');
        const appPath = path.resolve(args[2], workflow.provision[1].with.appPackagePath);
        const app = JSON.parse(strFromU8(unzipSync(readFileSync(appPath))['manifest.json']));
        assert.equal(values.TEAMS_APP_ID, app.id);
        assert.equal(options.env.TEAMS_APP_ID, app.id);
        assert.equal(options.env.TEAMS_APP_TENANT_ID, undefined);
        assert.equal(options.env.TEAMS_APP_UPDATE_TIME, undefined);
        assert.equal(workflow.provision[0].with.name, app.name.short);
        counts.registrations++;
        if (state.failRegistration) throw new Error('Teams registration failed');
        writeFileSync(environmentFile, [
          `TEAMS_APP_ID=${state.registeredAppId ?? app.id}`,
          `TEAMS_APP_TENANT_ID=${state.registeredTenant ?? config.tenantId}`
        ].join('\n'));
        const userFile = `${environmentFile}.user`;
        assert.equal(parseEnv(readFileSync(userFile, 'utf8')).TEAMS_APP_UPDATE_TIME, undefined, 'a previous update timestamp is not readback evidence');
        if (!state.missingUpdateTime) writeFileSync(userFile, `${readFileSync(userFile, 'utf8')}\nTEAMS_APP_UPDATE_TIME=2026-01-01T00:00:00Z\n`);
        state.registeredPackage = appPath;
        return '';
      }
      assert.deepEqual(args.slice(0, 2), ['install', '--file-path']);
      assert.equal(args[2], state.registeredPackage, 'Teams registration must precede M365 acquisition of the same package');
      assert.ok(args[2].includes('deployment test-'), 'paths with spaces remain one argument');
      assert.deepEqual(args.slice(3), ['--scope', 'Personal', '--interactive', 'false']);
      counts.installs++;
      return '';
    }
    assert.equal(command, 'az');
    if (args[0] === 'version') return JSON.stringify({ 'azure-cli': 'test' });
    if (args[0] !== 'version') assert.equal(args[args.indexOf('--subscription') + 1], config.subscriptionId);
    if (args[0] === 'account' && args[1] === 'show') return { tenantId: state.tenant };
    if (args[1] === 'get-access-token') return { accessToken: 'test-graph-token' };
    if (args[0] === 'group') {
      if (args[1] === 'list') return state.group ? [state.group] : [];
      counts.groups++;
      return state.group = { name: config.resourceGroup, tags: { copilotHandover: config.appName } };
    }
    if (args[0] === 'deployment') {
      counts.infrastructure++;
      const parameters = JSON.parse(readFileSync(args[args.indexOf('--parameters') + 1].slice(1), 'utf8')).parameters;
      assert.equal(parameters.appName.value, config.appName);
      assert.equal(parameters.oauthClientSecret, undefined);
      assert.equal(parameters.supportObjectIds, undefined);
      state.deployedBotId = parameters.botClientId?.value ?? config.subscriptionId;
      state.botDisplayName = parameters.displayName?.value;
      state.oauth = {
        clientId: parameters.oauthClientId.value,
        serviceProviderId: state.oauth?.serviceProviderId ?? parameters.serviceProviderId?.value ?? parameters.oauthServiceProviderId.value,
        scopes: 'https://api.powerplatform.com/.default',
        parameters: [
          { key: 'clientId', value: parameters.oauthClientId.value },
          { key: 'tenantId', value: config.tenantId },
          { key: 'uniqueIdentifier', value: parameters.federatedCredentialId.value },
          { key: 'tokenExchangeUrl', value: `api://botid-${state.deployedBotId}` }
        ]
      };
      if (args.includes(path.join(root, 'infra/local.bicep'))) return {};
      deployed.oauthClientId = parameters.oauthClientId.value;
      return { properties: { outputs: Object.fromEntries(Object.entries(deployed).map(([key, value]) => [key, { value }])) } };
    }
    if (args[0] === 'rest') {
      const url = new URL(args[args.indexOf('--url') + 1]);
      if (args[args.indexOf('--method') + 1] === 'delete') {
        assert.ok(url.pathname.endsWith('/connections/mcs'), 'only the owned mcs connection may be reset');
        state.oauth = undefined;
        state.oauthResets = (state.oauthResets ?? 0) + 1;
        return;
      }
      return { properties: url.pathname.endsWith('/connections/mcs')
        ? { ...state.oauth, ...state.oauthReadbackOverrides } : { msaAppId: state.deployedBotId, displayName: state.botDisplayName } };
    }
    if (args[0] === 'webapp') {
      counts.uploads++;
      const files = unzipSync(readFileSync(args[args.indexOf('--src-path') + 1]));
      assert.ok(files['src/server.ts']);
      assert.ok(Object.keys(files).every(name => !name.includes('.local') && !name.startsWith('agent/') && !name.startsWith('env/')));
      if (state.failUpload) throw new Error('Upload interrupted');
      return {};
    }
    throw new Error(`Unexpected command ${args.slice(0, 2).join(' ')}`);
  };
  const response = value => ({ ok: true, status: 200, json: async () => structuredClone(value) });
  const fetch = async (input, options = {}) => {
    const url = new URL(input);
    if (url.hostname !== 'graph.microsoft.com') {
      assert.notEqual(url.hostname, 'unrelated.contoso.test', 'deployment readiness must ignore a generic APP_URL override');
      if (url.pathname === '/health') return state.health ? response({ status: 'ok', mode: state.mock ? 'mock' : 'studio' }) : { ok: false, status: 503 };
      if (url.pathname === '/api/escalate') return { status: JSON.parse(options.body).conversationId ? 404 : 400 };
      if (url.pathname === '/api/messages') return { status: state.mock ? 503 : 401 };
      if (url.pathname === '/support.html' || url.pathname === '/api/support/me') return { status: url.hostname.endsWith('devtunnels.ms') ? 404 : 200 };
      throw new Error(`Unexpected endpoint: ${url.pathname}`);
    }
    const endpoint = url.pathname.slice('/v1.0/'.length), body = options.body && JSON.parse(options.body);
    if (endpoint === 'servicePrincipals' && url.search.includes('Power')) return response({ value: [{
      appId: config.environmentId, oauth2PermissionScopes: [{ id: config.subscriptionId, value: 'CopilotStudio.Copilots.Invoke' }]
    }] });
    if (endpoint === 'servicePrincipals') {
      if (body) { principals.set(body.appId, { id: randomUUID() }); return response(principals.get(body.appId)); }
      const id = url.searchParams.get('$filter').match(/'([^']+)'/)[1];
      return response({ value: principals.has(id) ? [principals.get(id)] : [] });
    }
    if (endpoint === 'applications') {
      if (!body) return response({ value: [...apps.values()].filter(app => url.searchParams.get('$filter').includes(app.displayName)) });
      counts.applications++;
      const app = { ...body, id: randomUUID(), appId: randomUUID(), passwordCredentials: [] };
      apps.set(app.id, app);
      if (state.failCreate) { state.failCreate = false; throw new Error('Lost create response'); }
      return response(app);
    }
    const [, id, operation] = endpoint.split('/');
    const app = apps.get(id);
    assert.ok(app, 'only a recorded application ID may be changed');
    if (operation === 'addPassword') {
      counts.passwords++;
      const credential = { ...body.passwordCredential, keyId: randomUUID() };
      app.passwordCredentials.push(credential);
      if (state.failPassword) throw new Error('Lost credential response');
      return response({ ...credential, secretText: `test-secret-${credential.keyId}` });
    }
    if (operation === 'federatedIdentityCredentials') {
      if (body) { counts.federations++; credentials.set(id, [body]); return response(body); }
      return response({ value: credentials.get(id) ?? [] });
    }
    if (options.method === 'PATCH') {
      if (state.graphError) return Response.json({ error: state.graphError }, { status: 400 });
      const persistedScopes = new Set((app.api?.oauth2PermissionScopes ?? []).map(scope => scope.id));
      if (body.api?.preAuthorizedApplications?.some(client => client.delegatedPermissionIds.some(id => !persistedScopes.has(id)))) {
        return Response.json({ error: { code: 'InvalidValue', message: 'Preauthorization references a scope that has not been persisted.' } }, { status: 400 });
      }
      Object.assign(app, body);
      return { status: 204, ok: true };
    }
    return response(app);
  };
  const setup = createSetup({ root: base, env, run, fetch, sleep: async () => {}, connector: async settings => {
    assert.equal(settings.approve, true); counts.connectors++;
  } });
  return { setup, base, local, save, state, counts, apps, env, deployed };
}

test('configure and doctor use only Azure CLI with an explicit environment and preserve the saved target', async t => {
  const f = await deploymentFixture(t);
  const configFile = path.join(f.local, 'config.json');
  await rm(configFile);
  await f.setup('doctor');
  const args = ['--subscription', config.subscriptionId, '--environment-id', config.environmentId, '--schema-name', config.schemaName];
  await f.setup('configure', args);
  const saved = JSON.parse(await readFile(configFile, 'utf8'));
  assert.equal(saved.tenantId, config.tenantId);
  assert.equal(saved.subscriptionId, config.subscriptionId);
  assert.equal(saved.environmentId, config.environmentId);
  assert.equal(saved.schemaName, config.schemaName);
  validate(saved, false);
  await f.setup('doctor');
  await f.setup('configure', args);
  assert.deepEqual(JSON.parse(await readFile(configFile, 'utf8')), saved);
  assert.ok(Object.values(f.counts).every(count => count === 0), 'configuration and diagnosis must not change cloud resources');
  f.state.tenant = config.subscriptionId;
  await assert.rejects(() => f.setup('doctor'), /tenant does not match/);
});

test('configure rejects incomplete or malformed target IDs without persisting partial configuration', async t => {
  const f = await deploymentFixture(t);
  const configFile = path.join(f.local, 'config.json');
  await rm(configFile);
  for (const [args, expected] of [
    [['--subscription', config.subscriptionId], /--subscription and --environment-id/],
    [['--environment-id', config.environmentId], /--subscription and --environment-id/],
    [['--subscription', config.subscriptionId, '--environment-id', 'invalid'], /environment-id must be a GUID/],
    [['--subscription', 'invalid', '--environment-id', config.environmentId], /subscription must be a GUID/]
  ]) {
    await assert.rejects(() => f.setup('configure', args), expected);
    assert.equal(existsSync(configFile), false);
    assert.equal(existsSync(path.join(f.local, 'secrets.env')), false);
  }
});

test('configuration refuses to retarget an existing setup or invoke the removed agent-creation stage', async t => {
  const f = await deploymentFixture(t);
  const before = await readFile(path.join(f.local, 'config.json'), 'utf8');
  await assert.rejects(() => f.setup('configure', ['--environment-id', config.subscriptionId]), /another environment/);
  await assert.rejects(() => f.setup('configure', ['--subscription', config.environmentId]), /another subscription/);
  await assert.rejects(() => f.setup('studio', ['--approve-studio']), /Unknown stage/);
  assert.equal(await readFile(path.join(f.local, 'config.json'), 'utf8'), before);
  assert.ok(Object.values(f.counts).every(count => count === 0));
});

test('deployment rejects unknown options, missing approvals and a mismatched tenant before cloud writes', async t => {
  const f = await deploymentFixture(t);
  assert.throws(() => argumentsFor('deploy', ['--target']), /requires a value/);
  assert.throws(() => argumentsFor('deploy', ['--target', '../bad']), /local or azure/);
  assert.throws(() => argumentsFor('deploy', ['--approve-azuer']), /Unexpected/);
  await assert.rejects(() => f.setup('deploy'), /approve-azure/);
  f.state.tenant = config.subscriptionId;
  await assert.rejects(() => f.setup('identity', ['--approve-identity']), /tenant/);
  assert.equal(f.counts.applications + f.counts.infrastructure, 0);
});

test('first deployment and rerun reuse identities, passwords, federation and group while reconciling desired settings', async t => {
  const f = await deploymentFixture(t);
  f.env.APP_URL = 'https://unrelated.contoso.test';
  const flags = ['--approve-identity', '--approve-azure', '--approve-connector', '--approve-install'];
  await f.setup('deploy', flags);
  const before = JSON.parse(await readFile(path.join(f.local, 'config.json'), 'utf8'));
  const sso = [...f.apps.values()].find(app => app.appId === before.oauthClientId);
  sso.web.redirectUris.push('https://contoso.test/keep');
  sso.identifierUris.push('api://contoso.test/keep');
  await f.setup('deploy', flags);
  assert.deepEqual(f.counts, { applications: 2, passwords: 1, federations: 1, uploads: 2, groups: 1, infrastructure: 2, registrations: 2, installs: 2, connectors: 2 });
  assert.equal(sso.passwordCredentials.length, 0, 'SSO uses federation; the mock console needs no secret');
  assert.notEqual(before.oauthClientId, before.botClientId);
  assert.deepEqual(JSON.parse(await readFile(path.join(f.local, 'config.json'), 'utf8')), before);
  assert.ok(sso.web.redirectUris.includes('https://contoso.test/keep'));
  assert.deepEqual(new Set(sso.identifierUris), new Set([
    `api://botid-${before.botClientId}`, `api://botid-${f.deployed.botClientId}`, 'api://contoso.test/keep'
  ]));
  assert.equal(sso.requiredResourceAccess[0].resourceAccess.length, 1);
  assert.equal(existsSync(path.join(f.local, 'setup.lock')), false);
  const names = Object.keys(unzipSync(await readFile(path.join(f.local, 'teams-m365.azure.zip'))));
  assert.deepEqual(names.sort(), ['color.png', 'manifest.json', 'outline.png']);
});

test('Graph validation failures expose their service reason without exposing credentials', async t => {
  const f = await deploymentFixture(t);
  f.state.graphError = { code: 'InvalidValue', message: 'Invalid scope; test-graph-token' };
  await assert.rejects(() => f.setup('identity', ['--approve-identity']), error => {
    assert.match(error.message, /failed \(400\): InvalidValue: Invalid scope; \[REDACTED\]/);
    assert.doesNotMatch(error.message, /test-graph-token/);
    return true;
  });
  assert.equal(existsSync(path.join(f.local, 'setup.lock')), false);
});

test('lost application-create response recovers only its tagged resource; missing secret never causes duplicate credential creation', async t => {
  const f = await deploymentFixture(t);
  f.state.failCreate = true;
  await assert.rejects(() => f.setup('identity', ['--approve-identity']), /Lost create response/);
  await f.setup('identity', ['--approve-identity']);
  assert.equal(f.counts.applications, 2);
  delete f.env.BOT_CLIENT_SECRET;
  await writeFile(path.join(f.local, 'secrets.env'), '');
  await assert.rejects(() => f.setup('identity', ['--approve-identity']), /BOT_CLIENT_SECRET/);
  assert.equal(f.counts.passwords, 1);
});

test('uncertain secret creation and changed deployment ownership fail closed on rerun', async t => {
  const f = await deploymentFixture(t);
  f.state.failPassword = true;
  await assert.rejects(() => f.setup('identity', ['--approve-identity']), /Lost credential/);
  await assert.rejects(() => f.setup('identity', ['--approve-identity']), /Credential creation is uncertain/);
  assert.equal(f.counts.passwords, 1);
  await f.save('config.json', { ...config, appName: 'another-sample' });
  await assert.rejects(() => f.setup('identity', ['--approve-identity']), /another target/);
  assert.equal(f.counts.applications, 1);
});

test('an uncertain app create without its exact ownership tag cannot allocate a replacement', async t => {
  const f = await deploymentFixture(t);
  f.state.failCreate = true;
  await assert.rejects(() => f.setup('identity', ['--approve-identity']), /Lost create response/);
  for (const app of f.apps.values()) app.tags = ['copilot-studio-handover-sample'];
  await assert.rejects(() => f.setup('identity', ['--approve-identity']), /creation is uncertain/);
  assert.equal(f.counts.applications, 1);
});

test('existing unowned Azure groups are never deployed into', async t => {
  const f = await deploymentFixture(t);
  f.state.group = { name: config.resourceGroup, tags: { copilotHandover: 'another-owner' } };
  await assert.rejects(() => f.setup('deploy', ['--approve-azure']), /not marked as owned/);
  assert.equal(f.counts.infrastructure + f.counts.uploads + f.counts.groups, 0);
});

test('interrupted ZIP upload resumes with the same resources and never claims installation or connector success', async t => {
  const f = await deploymentFixture(t);
  await f.save('deployment.json', f.deployed);
  f.state.failUpload = true;
  await assert.rejects(() => f.setup('deploy', ['--approve-azure', '--approve-install']), /Upload interrupted/);
  assert.ok(existsSync(path.join(f.local, 'deployment.json')));
  assert.equal(f.counts.installs + f.counts.connectors, 0);
  f.state.failUpload = false;
  await f.setup('deploy', ['--approve-azure']);
  assert.equal(f.counts.groups, 1);
  assert.equal(f.counts.uploads, 2);
});

test('local lifecycle reuses the saved tunnel and never provisions App Service or uploads a ZIP', async t => {
  const f = await deploymentFixture(t);
  await f.save('deployment.local.json', { appUrl: 'https://example-3979.euw.devtunnels.ms', botClientId: config.botClientId, botName: `${config.appName}-local-bot` });
  await f.setup('deploy', ['--target', 'local', '--approve-azure', '--approve-connector']);
  await f.setup('deploy', ['--target', 'local', '--approve-azure']);
  assert.equal(f.counts.infrastructure, 2);
  assert.equal(f.counts.uploads, 0);
  assert.equal(f.counts.connectors, 1);
  assert.ok(existsSync(path.join(f.local, 'teams-m365.local.zip')));
});

test('legacy Bot OAuth migration recreates only mcs once when ARM silently retains the old provider', async t => {
  const f = await deploymentFixture(t);
  await f.save('deployment.json', f.deployed);
  await f.save('config.json', { ...config, oauthServiceProviderId: 'c00b44ab-5e16-c44c-af26-2fd5bc55eb18' });
  f.state.oauth = { serviceProviderId: '30dd229c-58e3-4a48-bdfd-91ec48eb906c' };
  await f.setup('deploy', ['--approve-azure']);
  await f.setup('deploy', ['--approve-azure']);
  assert.equal(f.state.oauthResets, 1);
  assert.equal(f.counts.infrastructure, 3);
  assert.equal(f.state.oauth.serviceProviderId, 'c00b44ab-5e16-c44c-af26-2fd5bc55eb18');
});

test('an unexpected OAuth provider is never automatically deleted', async t => {
  const f = await deploymentFixture(t);
  f.state.oauth = { serviceProviderId: config.subscriptionId };
  await assert.rejects(() => f.setup('deploy', ['--approve-azure', '--approve-install']), /unexpected provider/);
  assert.equal(f.state.oauthResets, undefined);
  assert.equal(f.counts.installs + f.counts.uploads, 0);
});

test('successful ARM deployment with mismatched OAuth readback cannot proceed to upload or installation', async t => {
  const f = await deploymentFixture(t);
  f.state.oauthReadbackOverrides = { scopes: 'wrong-scope' };
  await assert.rejects(() => f.setup('deploy', ['--approve-azure', '--approve-install']), /OAuth readback/);
  assert.equal(f.counts.installs + f.counts.uploads, 0);
});

test('unhealthy deployments fail explicitly without installing or provisioning a connector', async t => {
  const f = await deploymentFixture(t);
  await f.save('deployment.json', f.deployed);
  f.state.health = false;
  await assert.rejects(() => f.setup('deploy', ['--approve-azure', '--approve-connector', '--approve-install']), /readiness failed/);
  assert.equal(f.counts.installs + f.counts.connectors, 0);
});

test('deployment locks reject concurrent writers and are released after a failed operation', async t => {
  const f = await deploymentFixture(t);
  const lock = path.join(f.local, 'setup.lock');
  await withLock(lock, async () => {
    await assert.rejects(() => f.setup('identity', ['--approve-identity']), /Another operation/);
  });
  await assert.rejects(() => withLock(lock, () => { throw new Error('expected failure'); }), /expected failure/);
  assert.equal(existsSync(lock), false);
  assert.equal(f.counts.applications, 0);
});

test('Azure-assigned hostnames keep customer OAuth without adding console sign-in redirects', async t => {
  const f = await deploymentFixture(t);
  f.deployed.appUrl = `https://${config.appName}-app-hash.eastus-01.azurewebsites.net`;
  await f.setup('deploy', ['--approve-identity', '--approve-azure']);
  const saved = JSON.parse(await readFile(path.join(f.local, 'config.json'), 'utf8'));
  const app = [...f.apps.values()].find(app => app.appId === saved.oauthClientId);
  assert.deepEqual(app.web.redirectUris, ['https://token.botframework.com/.auth/web/redirect']);
  assert.equal(saved.websiteUrl, config.websiteUrl, 'custom developer links are preserved');
  await f.setup('deploy', ['--approve-azure']);
  assert.equal(f.counts.applications, 2);
  assert.equal(f.counts.passwords, 1);
});

test('a newly resolved Azure bot ID requires approved SSO reconciliation and resumes without replacing identities', async t => {
  const f = await deploymentFixture(t);
  await f.setup('identity', ['--approve-identity']);
  const before = JSON.parse(await readFile(path.join(f.local, 'config.json'), 'utf8'));
  await assert.rejects(() => f.setup('deploy', ['--approve-azure']), /--approve-identity.*SSO resource URI/);
  const pending = JSON.parse(await readFile(path.join(f.local, 'deployment.json'), 'utf8'));
  assert.equal(pending.ssoConfigurationPending, true);
  assert.equal(f.counts.uploads, 0);
  await f.setup('deploy', ['--approve-identity', '--approve-azure']);
  assert.deepEqual(JSON.parse(await readFile(path.join(f.local, 'config.json'), 'utf8')), before);
  assert.equal(JSON.parse(await readFile(path.join(f.local, 'deployment.json'), 'utf8')).ssoConfigurationPending, undefined);
  const sso = [...f.apps.values()].find(app => app.appId === before.oauthClientId);
  assert.ok(sso.identifierUris.includes(`api://botid-${pending.botClientId}`));
  assert.ok(sso.identifierUris.includes(`api://botid-${before.botClientId}`), 'adding Azure SSO must preserve local SSO');
  assert.equal(f.counts.applications, 2);
  assert.equal(f.counts.passwords, 1);
  const app = JSON.parse(strFromU8(unzipSync(await readFile(path.join(f.local, 'teams-m365.azure.zip')))['manifest.json']));
  assert.equal(app.webApplicationInfo.id, before.oauthClientId);
  assert.equal(app.webApplicationInfo.resource, `api://botid-${pending.botClientId}`);
});

test('an OAuth connection using the SSO app ID as its resource fails deployment readback', async t => {
  const f = await deploymentFixture(t);
  f.state.oauthReadbackOverrides = { parameters: [
    { key: 'ClientId', value: config.oauthClientId },
    { key: 'TenantId', value: config.tenantId },
    { key: 'UniqueIdentifier', value: config.federatedCredentialId },
    { key: 'TokenExchangeUrl', value: `api://botid-${config.oauthClientId}` }
  ] };
  await assert.rejects(() => f.setup('deploy', ['--approve-azure']), /OAuth readback/);
  assert.equal(f.counts.uploads, 0);
});

test('package regeneration preserves the provisioned connector ownership marker', async t => {
  const f = await deploymentFixture(t);
  await f.save('deployment.json', f.deployed);
  await f.save('connector.azure.json', {
    tenantId: config.tenantId, environmentId: config.environmentId,
    displayName: 'Existing escalation', ownership: 'sample-marker'
  });
  await f.setup('package', ['--target', 'azure']);
  const definition = JSON.parse(await readFile(path.join(f.local, 'generated/azure/escalation.swagger.json'), 'utf8'));
  assert.equal(definition.info.description, 'Sample ownership: sample-marker');
  assert.equal(definition.info.title, 'Existing escalation');
});

test('fresh per-target Teams app IDs survive package reruns without replacing bot or SSO identities', async t => {
  const f = await deploymentFixture(t);
  const teamsAppIds = { local: randomUUID(), azure: randomUUID() };
  await f.save('config.json', { ...config, teamsAppIds });
  await f.save('deployment.json', f.deployed);
  await f.save('deployment.local.json', { appUrl: 'https://local.contoso.test', botName: `${config.appName}-local-bot`, botClientId: config.botClientId });
  for (const target of ['local', 'azure']) {
    for (let attempt = 0; attempt < 2; attempt++) {
      await f.setup('package', ['--target', target]);
      const files = unzipSync(await readFile(path.join(f.local, `teams-m365.${target}.zip`)));
      const manifest = JSON.parse(strFromU8(files['manifest.json']));
      assert.equal(manifest.id, teamsAppIds[target]);
      assert.deepEqual(JSON.parse(await readFile(path.join(f.local, `generated/${target}/manifest.json`), 'utf8')), manifest);
      assert.equal(manifest.bots[0].botId, target === 'local' ? config.botClientId : f.deployed.botClientId);
      assert.equal(manifest.webApplicationInfo.id, config.oauthClientId);
      assert.equal(manifest.webApplicationInfo.resource, `api://botid-${manifest.bots[0].botId}`, 'SSO uses the bot ID, not the Teams app or SSO registration ID');
    }
  }
  assert.equal(f.counts.applications + f.counts.infrastructure, 0);
});

test('personal installation registers the selected Teams identity before acquiring it, including reruns and inherited ATK variables', async t => {
  const f = await deploymentFixture(t);
  const teamsAppIds = { local: randomUUID(), azure: randomUUID() };
  await f.save('config.json', { ...config, teamsAppIds, displayName: 'Handover Fresh' });
  await f.save('deployment.json', f.deployed);
  await f.save('deployment.local.json', { appUrl: 'https://local.contoso.test', botName: `${config.appName}-local-bot`, botClientId: config.botClientId });
  Object.assign(f.env, { TEAMS_APP_ID: randomUUID(), TEAMS_APP_TENANT_ID: randomUUID(), TEAMS_APP_UPDATE_TIME: 'stale' });
  const inherited = { ...f.env };
  await assert.rejects(() => f.setup('install', ['--target', 'local']), /approve-install/);
  assert.equal(f.counts.registrations, 0);
  for (const target of ['local', 'azure']) {
    for (let attempt = 0; attempt < 2; attempt++) {
      await f.setup('install', ['--target', target, '--approve-install']);
      const registered = parseEnv(await readFile(path.join(f.local, `generated/${target}/teams-app/env/.env.install`), 'utf8'));
      assert.equal(registered.TEAMS_APP_ID, teamsAppIds[target]);
      assert.equal(registered.TEAMS_APP_TENANT_ID, config.tenantId);
    }
  }
  assert.deepEqual(f.env, inherited, 'registration cannot retarget the parent lifecycle');
  assert.equal(f.counts.registrations, 4);
  assert.equal(f.counts.installs, 4);
  assert.equal(f.counts.applications + f.counts.infrastructure, 0);
});

test('failed or mismatched Teams registration cannot proceed to personal acquisition', async t => {
  const f = await deploymentFixture(t);
  await f.save('deployment.json', f.deployed);
  for (const [field, value, message] of [
    ['failRegistration', true, /Teams registration failed/],
    ['registeredTenant', randomUUID(), /readback did not match/],
    ['registeredAppId', randomUUID(), /readback did not match/],
    ['missingUpdateTime', true, /readback did not match/]
  ]) {
    f.state[field] = value;
    await assert.rejects(() => f.setup('install', ['--target', 'azure', '--approve-install']), message);
    delete f.state[field];
  }
  assert.equal(f.counts.installs, 0);
  await f.setup('install', ['--target', 'azure', '--approve-install']);
  assert.equal(f.counts.installs, 1, 'a successful retry resumes the same package');
});

test('Teams-only sideloading uploads the selected package without M365 acquisition on either target', async t => {
  const f = await deploymentFixture(t);
  const teamsAppIds = { local: randomUUID(), azure: randomUUID() };
  await f.save('config.json', { ...config, teamsAppIds, displayName: 'Handover Direct', appVersion: '1.0.2' });
  await f.save('deployment.json', f.deployed);
  await f.save('deployment.local.json', { appUrl: 'https://local.contoso.test', botName: `${config.appName}-local-bot`, botClientId: config.botClientId });
  await assert.rejects(() => f.setup('install', ['--teams-only']), /requires --approve-install/);
  assert.equal(f.counts.registrations, 0);
  for (const target of ['local', 'azure']) {
    for (let attempt = 0; attempt < 2; attempt++) {
      await f.setup('install', ['--target', target, '--approve-install', '--teams-only']);
      const app = JSON.parse(strFromU8(unzipSync(await readFile(f.state.registeredPackage))['manifest.json']));
      assert.equal(app.id, teamsAppIds[target]);
      assert.equal(app.version, '1.0.2');
      assert.equal(app.name.short, 'Handover Direct');
      assert.equal(app.webApplicationInfo.resource, `api://botid-${app.bots[0].botId}`);
    }
  }
  assert.equal(f.counts.registrations, 4);
  assert.equal(f.counts.installs + f.counts.applications + f.counts.infrastructure, 0);
  f.state.registeredTenant = randomUUID();
  await assert.rejects(() => f.setup('install', ['--target', 'local', '--approve-install', '--teams-only']), /readback did not match/);
});

test('complete deployment forwards Teams-only distribution and rejects an unapproved mode before writes', async t => {
  const f = await deploymentFixture(t);
  await f.save('deployment.json', f.deployed);
  await assert.rejects(() => f.setup('deploy', ['--approve-azure', '--teams-only']), /requires --approve-install/);
  assert.equal(f.counts.infrastructure + f.counts.registrations, 0);
  await f.setup('deploy', ['--approve-azure', '--approve-install', '--teams-only']);
  assert.equal(f.counts.registrations, 1);
  assert.equal(f.counts.installs, 0);
  assert.equal(f.counts.uploads, 1);
});

test('configured display name reaches Azure Bot and Teams packages on both hosting targets', async t => {
  const f = await deploymentFixture(t);
  await f.save('deployment.json', f.deployed);
  await f.save('config.json', { ...config, displayName: 'Handover Fresh' });
  await f.save('deployment.local.json', { appUrl: 'https://fresh-3979.euw.devtunnels.ms', botName: `${config.appName}-local-bot`, botClientId: config.botClientId });
  for (const target of ['local', 'azure']) {
    await f.setup('deploy', ['--target', target, '--approve-azure']);
    assert.equal(f.state.botDisplayName, 'Handover Fresh');
    const files = unzipSync(await readFile(path.join(f.local, `teams-m365.${target}.zip`)));
    const manifest = JSON.parse(strFromU8(files['manifest.json']));
    assert.equal(manifest.name.short, 'Handover Fresh');
  }
});

test('migration retains the installed legacy bot and its credential while creating only the separate SSO app', async t => {
  const f = await deploymentFixture(t);
  const objectId = randomUUID();
  const oldApp = { id: objectId, appId: config.oauthClientId, displayName: `${config.appName}-oauth`,
    tags: ['copilot-studio-handover-sample'], api: { requestedAccessTokenVersion: 2 }, passwordCredentials: [] };
  f.apps.set(objectId, structuredClone(oldApp));
  await f.save('oauth-identity.json', { objectId, clientId: oldApp.appId, tenantId: config.tenantId });
  await f.save('deployment.local.json', { appUrl: 'https://local.contoso.test', botClientId: oldApp.appId, botName: `${config.appName}-local-bot` });
  await f.save('deployment.json', f.deployed);
  await f.save('config.json', { ...config, botClientId: undefined, federatedCredentialId: undefined });
  const oldSecret = f.env.OAUTH_CLIENT_SECRET = 'test-legacy-bot-secret';
  delete f.env.BOT_CLIENT_SECRET;
  await f.setup('identity', ['--approve-identity']);
  await f.setup('identity', ['--approve-identity']);
  const saved = JSON.parse(await readFile(path.join(f.local, 'config.json'), 'utf8'));
  assert.equal(saved.botClientId, oldApp.appId);
  assert.notEqual(saved.oauthClientId, oldApp.appId);
  assert.equal(f.env.BOT_CLIENT_SECRET, oldSecret);
  assert.deepEqual(f.apps.get(objectId), oldApp);
  assert.equal(f.counts.applications, 1);
  assert.equal(f.counts.passwords, 0);
});

test('default smoke accepts the disabled mock Bot endpoint without treating it as a live deployment', async t => {
  const f = await deploymentFixture(t);
  f.state.mock = true;
  await f.setup('smoke');
  await f.save('deployment.json', f.deployed);
  await assert.rejects(() => f.setup('smoke', ['--target', 'azure']), /Bot callback/);
  assert.equal(f.counts.infrastructure + f.counts.installs, 0);
});
