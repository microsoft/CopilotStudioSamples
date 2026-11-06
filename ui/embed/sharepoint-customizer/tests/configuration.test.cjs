const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeConfiguration } = require('../temp/tests/configuration');
const { createSideloadUrl, COMPONENT_ID } = require('../scripts/sideload.cjs');
const properties = { appClientId: 'client', tenantId: 'tenant', environmentId: 'environment', schemaName: 'agent' };

test('discovery settings default uploads and typing on, details off', () => {
  assert.deepEqual(normalizeConfiguration(properties), {
    ...properties, directConnectUrl: undefined, startConversation: false, showTyping: true, enableFileUpload: true,
    showReasoning: false, showToolCalls: false,
    starterPrompts: [{ title: 'Get started', text: 'What can you help me with?' }]
  });
});
test('legacy identifier remains supported, canonical schema takes precedence', () => {
  assert.equal(normalizeConfiguration({ ...properties, schemaName: undefined, agentIdentifier: 'legacy' }).schemaName, 'legacy');
  assert.equal(normalizeConfiguration({ ...properties, agentIdentifier: 'legacy' }).schemaName, 'agent');
});
test('explicit direct URLs remain supported without environment or schema', () => {
  assert.equal(normalizeConfiguration({ appClientId: 'c', tenantId: 't', directConnectUrl: 'https://example.com/bot' }).directConnectUrl, 'https://example.com/bot');
  assert.throws(() => normalizeConfiguration({ ...properties, directConnectUrl: 'http://example.com' }), /HTTPS/);
});
test('missing properties and malformed flags fail visibly', () => {
  assert.throws(() => normalizeConfiguration({ ...properties, tenantId: ' ' }), /tenantId/);
  assert.throws(() => normalizeConfiguration({ ...properties, schemaName: '' }), /schemaName/);
  assert.throws(() => normalizeConfiguration({ ...properties, showReasoning: 'false' }), /boolean|true or false/);
});
test('debug URL preserves page parameters and round-trips JSON exactly', () => {
  const config = { ...properties, agentTitle: 'Help & files #1', startConversation: true, showReasoning: true, showToolCalls: false,
    starterPrompts: [{ title: 'A & B', text: 'Explain A & B.' }] };
  const url = new URL(createSideloadUrl('https://example.sharepoint.com/sites/dev/?view=1', config));
  assert.equal(url.searchParams.get('view'), '1');
  assert.equal(url.searchParams.get('loadSPFX'), 'true');
  assert.equal(url.searchParams.get('debugManifestsFile'), 'https://localhost:4321/temp/build/manifests.js');
  assert.deepEqual(JSON.parse(url.searchParams.get('customActions'))[COMPONENT_ID], {
    location: 'ClientSideExtension.ApplicationCustomizer', properties: config
  });
  assert.equal(JSON.parse(url.searchParams.get('customActions'))[COMPONENT_ID].properties.directConnectUrl, undefined);
});
test('automatic conversation start is opt-in and requires a boolean', () => {
  assert.equal(normalizeConfiguration(properties).startConversation, false);
  assert.equal(normalizeConfiguration({ ...properties, startConversation: true }).startConversation, true);
  assert.equal(normalizeConfiguration({ ...properties, startConversation: false }).startConversation, false);
  for (const startConversation of [null, 'false', 0, {}]) {
    assert.throws(() => normalizeConfiguration({ ...properties, startConversation }), /startConversation/);
    assert.throws(() => createSideloadUrl('https://example.com', { ...properties, startConversation }), /startConversation/);
  }
});
test('starter prompts accept custom text or an empty list, and reject malformed or extra fields', () => {
  assert.deepEqual(normalizeConfiguration({ ...properties, starterPrompts: [] }).starterPrompts, []);
  assert.deepEqual(normalizeConfiguration({ ...properties, starterPrompts: [{ title: ' Start ', text: ' Help me ' }] }).starterPrompts,
    [{ title: 'Start', text: 'Help me' }]);
  for (const starterPrompts of [null, 'text', [{}], [{ title: 'Start', text: '' }],
    [{ title: 'Start', text: 'Hello', clientSecret: 'not-allowed' }]]) {
    assert.throws(() => normalizeConfiguration({ ...properties, starterPrompts }), /starter prompt|starterPrompts/);
    assert.throws(() => createSideloadUrl('https://example.com', { ...properties, starterPrompts }), /starterPrompts/);
  }
});
test('debug URL rejects credentials, unknown properties, missing settings, and non-HTTPS manifests', () => {
  assert.throws(() => createSideloadUrl('https://example.com', { ...properties, accessToken: 'secret' }), /Unknown property/);
  assert.throws(() => createSideloadUrl('https://example.com', {}), /Provide/);
  assert.throws(() => createSideloadUrl('https://user:password@example.com', properties), /credentials/);
  assert.throws(() => createSideloadUrl('https://example.com', properties, 'http://localhost:4321/manifest.js'), /HTTPS/);
});
