const { test } = require('node:test');
const assert = require('node:assert/strict');
const { filter, firstValueFrom, lastValueFrom, timeout } = require('rxjs');
const { Activity } = require('@microsoft/agents-activity');
const { ConnectionSettings, CopilotStudioClient } = require('@microsoft/agents-copilotstudio-client');
const { normalizeConfiguration } = require('../temp/tests/configuration');
const { createConnection } = require('../temp/tests/components/Chat/createConnection');

test('lazy start creates a conversation silently before executing the first message, then reuses its header-only ID', async t => {
  const requests = [];
  const host = 'https://000000000000000000000000000000.01.environment.api.powerplatform.com';
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const path = new URL(url).pathname;
    if (path.endsWith('/conversation-endpoints')) {
      requests.push({ operation: 'discovery' });
      return Response.json({
        createConversation: `${host}/conversations`,
        executeTurn: `${host}/conversations/{conversationId}`,
        continueTurn: `${host}/conversations/{conversationId}/continue`
      });
    }
    const body = JSON.parse(options.body);
    const create = path === '/conversations';
    assert.ok(create || path === '/conversations/header-only-id', `Unexpected URL: ${url}`);
    requests.push({ operation: create ? 'create' : 'execute', body });
    // A create endpoint establishes a session; it does not execute an activity in the request.
    const activity = create
      ? { type: 'typing', from: { id: 'agent', role: 'bot' } }
      : { type: 'message', id: `answer-${requests.length}`, from: { id: 'agent', role: 'bot' }, text: `Reply: ${body.activity.text}` };
    return new Response(`event: activity\ndata: ${JSON.stringify(activity)}\n\nevent: end\ndata: done\n\n`, {
      headers: { 'content-type': 'text/event-stream', 'x-ms-conversationid': 'header-only-id' }
    });
  });
  const configuration = normalizeConfiguration({
    appClientId: 'client', tenantId: 'tenant',
    environmentId: '00000000-0000-0000-0000-000000000001', schemaName: 'fixture'
  });
  const client = new CopilotStudioClient(new ConnectionSettings(configuration), 'fixture-token');
  const failures = [];
  const connection = createConnection(client, configuration, {
    onTurn() {}, onTurnEnd() {}, onError(error) { failures.push(error.message); }
  });
  t.after(() => connection.end());
  const received = [];
  const subscription = connection.activity$.subscribe(activity => received.push(activity));
  t.after(() => subscription.unsubscribe());
  await firstValueFrom(connection.connectionStatus$.pipe(filter(status => status === 2), timeout(2000)));
  assert.deepEqual(requests, [], 'Opening the panel must not start a remote conversation');
  const send = text => lastValueFrom(connection.postActivity(Activity.fromObject({
    type: 'message', text, from: { id: 'user', role: 'user' }
  })).pipe(timeout(2000)));
  await send('First question');
  assert.deepEqual(requests.map(request => request.operation), ['discovery', 'create', 'execute']);
  assert.deepEqual(requests[1].body, { emitStartConversationEvent: false });
  assert.equal(requests[2].body.activity.text, 'First question');
  assert.ok(received.some(activity => activity.text === 'Reply: First question'));
  await send('Follow-up');
  assert.deepEqual(requests.map(request => request.operation), ['discovery', 'create', 'execute', 'execute']);
  assert.ok(received.some(activity => activity.text === 'Reply: Follow-up'));
  assert.deepEqual(failures, []);
});
