const { test } = require('node:test');
const assert = require('node:assert/strict');
const { firstValueFrom, lastValueFrom, filter, timeout } = require('rxjs');
const { Activity } = require('@microsoft/agents-activity');
const { ConnectionSettings, CopilotStudioClient } = require('@microsoft/agents-copilotstudio-client');
const { normalizeConfiguration } = require('../temp/tests/configuration');
const { createConnection } = require('../temp/tests/components/Chat/createConnection');
const { thought, toolCall, standardPlan, standardStep } = require('./fixtures/sdkActivities.cjs');

for (const showReasoning of [false, true]) {
  for (const showToolCalls of [false, true]) {
    test(`real SDK entity mapping: reasoning=${showReasoning}, tools=${showToolCalls}`, async t => {
      const host = 'https://000000000000000000000000000000.01.environment.api.powerplatform.com';
      const stream = { streamType: 'streaming', streamId: 'answer-stream', chunkType: 'delta' };
      t.mock.method(globalThis, 'fetch', async url => {
        const path = new URL(url).pathname;
        if (path.endsWith('/conversation-endpoints')) {
          return Response.json({
            createConversation: `${host}/conversations`,
            executeTurn: `${host}/conversations/{conversationId}`,
            continueTurn: `${host}/conversations/{conversationId}/continue`
          });
        }

        assert.ok(path === '/conversations' || path === '/conversations/header-only-id');
        const activities = path === '/conversations' ? [{ type: 'typing' }] : [
          thought('Check ', 1), thought('the list', 2), thought('Check the list', 3, 'replace'),
          toolCall('started', { streamSequence: 4 }), toolCall('completed', { streamSequence: 5 }),
          { type: 'typing', id: 'answer-part-1', text: 'Here are ', channelData: { ...stream, streamSequence: 6 } },
          { type: 'typing', id: 'answer-part-2', text: 'the items.', channelData: { ...stream, streamSequence: 7 } },
          { type: 'message', id: 'answer', text: 'Here are the items.', channelData: { streamType: 'final', streamId: 'answer-stream' } },
          { type: 'event', name: 'turn.complete' }
        ];
        return new Response(activities.map(activity => `event: activity\ndata: ${JSON.stringify(activity)}\n\n`).join('') +
          'event: end\ndata: done\n\n', {
          headers: { 'content-type': 'text/event-stream', 'x-ms-conversationid': 'header-only-id' }
        });
      });
      const configuration = normalizeConfiguration({
        appClientId: 'client', tenantId: 'tenant',
        environmentId: '00000000-0000-0000-0000-000000000001', schemaName: 'fixture',
        showReasoning, showToolCalls
      });
      const failures = [];
      const connection = createConnection(new CopilotStudioClient(new ConnectionSettings(configuration), 'fixture-token'), configuration, {
        onTurn() {}, onTurnEnd() {}, onError(error) { failures.push(error.message); }
      });
      const received = [];
      const subscription = connection.activity$.subscribe(activity => received.push(activity));
      t.after(() => { subscription.unsubscribe(); connection.end(); });
      await firstValueFrom(connection.connectionStatus$.pipe(filter(status => status === 2), timeout(2000)));
      await lastValueFrom(connection.postActivity(Activity.fromObject({
        type: 'message', text: 'List items', from: { id: 'user', role: 'user' }
      })).pipe(timeout(2000)));

      const reasoning = received.filter(activity => activity.id?.includes(':reasoning:'));
      const tools = received.filter(activity => activity.id?.includes(':tool:'));
      assert.equal(new Set(reasoning.map(activity => activity.id)).size, Number(showReasoning));
      assert.equal(new Set(tools.map(activity => activity.id)).size, Number(showToolCalls));
      if (showReasoning) {
        assert.equal(reasoning.at(-1).text, 'Check the list');
        assert.equal(reasoning.at(-1).entities[0].abstract, 'Reasoning');
      }
      if (showToolCalls) {
        assert.equal(tools.at(-1).entities[0].abstract, 'Get items');
        assert.equal(tools.at(-1).text, 'Finished');
      }
      assert.ok(received.some(activity => activity.type === 'typing' && activity.text === 'Here are the items.'));
      assert.ok(received.some(activity => activity.id === 'answer' && activity.text === 'Here are the items.'));
      assert.ok(!received.some(activity => activity.text === 'Get items completed'));
      assert.ok(!JSON.stringify(received).includes('PRIVATE_'));
      assert.ok(!received.some(activity => activity.entities?.some(entity => ['thought', 'toolCall'].includes(entity.type))));
      assert.deepEqual(failures, []);
    });
  }
}

for (const showReasoning of [false, true]) {
  for (const showToolCalls of [false, true]) {
    test(`real SDK standard mapping: reasoning=${showReasoning}, tools=${showToolCalls}`, async t => {
      const host = 'https://000000000000000000000000000000.01.environment.api.powerplatform.com';
      const base = `${host}/copilotstudio/dataverse-backed/authenticated/bots/fixture/conversations`;
      const requests = [];
      let turn = 0;
      t.mock.method(globalThis, 'fetch', async (url, options) => {
        const path = new URL(url).pathname;
        requests.push({ path, method: options?.method || 'GET' });
        if (path.endsWith('/conversation-endpoints')) return Response.json({
          createConversation: `${base}?api-version=2022-03-01-preview`,
          executeTurn: `${base}/{conversationId}?api-version=2022-03-01-preview`,
          continueTurn: `${base}/{conversationId}/continue?api-version=2022-03-01-preview`,
          subscribe: `${base}/{conversationId}/subscribe?api-version=2022-03-01-preview`
        });
        const start = path.endsWith('/conversations');
        if (!start) {
          assert.ok(path.endsWith('/conversations/standard-conversation'));
          turn++;
        }
        const final = {
          type: 'message', id: `standard-answer-${turn}`, from: { id: 'bot', role: 'bot' },
          text: turn === 1 ? 'Which units should I use?' : 'The weather is clear.',
          entities: [{ type: 'streaminfo', streamType: 'final', streamId: `stream-${turn}` }],
          channelData: { streamType: 'final', streamId: `stream-${turn}` }
        };
        const activities = start ? [{ type: 'typing' }] : turn === 1 ? [
          { type: 'typing', text: 'Generating plan...', entities: [{ type: 'streaminfo', streamType: 'informative' }] },
          standardPlan(),
          standardStep('DynamicPlanStepTriggered', {
            thought: 'Check current conditions for the requested city.', state: 'inProgress', type: 'Action'
          }),
          standardStep('DynamicPlanStepBindUpdate', { arguments: { Location: 'PRIVATE_CITY' } }),
          final
        ] : [
          standardStep('DynamicPlanStepBindUpdate', { arguments: { units: 'PRIVATE_UNITS' } }),
          // Completion is a regression fixture; the live weather test stopped at connector sign-in.
          standardStep('DynamicPlanStepFinished', { result: 'PRIVATE_WEATHER_RESULT' }),
          final
        ];
        return new Response(activities.map(activity => `event: activity\ndata: ${JSON.stringify(activity)}\n\n`).join('') +
          'event: end\ndata: done\n\n', {
          headers: { 'content-type': 'text/event-stream', 'x-ms-conversationid': 'standard-conversation' }
        });
      });
      const configuration = normalizeConfiguration({
        appClientId: 'client', tenantId: 'tenant',
        environmentId: '00000000-0000-0000-0000-000000000001', schemaName: 'fixture',
        showReasoning, showToolCalls
      });
      const failures = [];
      let ended = 0;
      const connection = createConnection(new CopilotStudioClient(new ConnectionSettings(configuration), 'fixture-token'), configuration, {
        onTurn() {}, onTurnEnd() { ended++; }, onError(error) { failures.push(error.message); }
      });
      const received = [];
      const subscription = connection.activity$.subscribe(activity => received.push(activity));
      t.after(() => { subscription.unsubscribe(); connection.end(); });
      await firstValueFrom(connection.connectionStatus$.pipe(filter(status => status === 2), timeout(2000)));
      for (const text of ['Check Seattle weather', 'Metric']) {
        await lastValueFrom(connection.postActivity(Activity.fromObject({
          type: 'message', text, from: { id: 'user', role: 'user' }
        })).pipe(timeout(2000)));
      }
      const reasoning = received.filter(activity => activity.id?.includes(':reasoning:'));
      const tools = received.filter(activity => activity.id?.includes(':tool:'));
      assert.equal(new Set(reasoning.map(activity => activity.id)).size, Number(showReasoning));
      assert.equal(new Set(tools.map(activity => activity.id)).size, Number(showToolCalls) * 2);
      if (showReasoning) {
        assert.equal(reasoning.at(-1).text, 'Check current conditions for the requested city.');
        assert.equal(reasoning.at(-1).entities[0].abstract, 'Reasoning');
        assert.equal(reasoning.at(-1).entities[0].creativeWorkStatus, 'Published');
      }
      if (showToolCalls) {
        assert.ok(tools.every(activity => activity.entities[0].abstract === 'Get current weather'));
        assert.ok(tools.some(activity => activity.text === 'No finish event received.'));
        assert.equal(tools.at(-1).text, 'Finished');
      }
      assert.equal(ended, 2);
      assert.equal(received.filter(activity => activity.id?.startsWith('standard-answer-')).length, 2);
      assert.ok(!received.some(activity => activity.text === 'Generating plan...'));
      assert.ok(!received.some(activity => activity.type === 'event'));
      assert.ok(!JSON.stringify(received).includes('PRIVATE_'));
      assert.deepEqual(failures, []);
      assert.equal(requests.length, 4);
      assert.ok(requests.every(request => !request.path.endsWith('/subscribe')));
    });
  }
}
