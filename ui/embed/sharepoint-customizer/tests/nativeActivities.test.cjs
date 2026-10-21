const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeConfiguration } = require('../temp/tests/configuration');
const { createPreChatActivity, NativeActivityAdapter } = require('../temp/tests/components/Chat/nativeActivities');
const { thought, toolCall } = require('./fixtures/sdkActivities.cjs');

const configuration = overrides => normalizeConfiguration({
  appClientId: 'client', tenantId: 'tenant', environmentId: 'environment', schemaName: 'agent', ...overrides
});
const tool = (valueType, value = {}) => ({
  type: 'event', valueType, value: { taskDialogId: 'lookup', stepId: 'call', ...value }
});

test('welcome uses the native Fluent PreChatMessage and editable messageBack starter contract', () => {
  const activity = createPreChatActivity(configuration());
  assert.equal(activity.type, 'message');
  assert.equal(activity.entities[0].type, 'https://schema.org/Message');
  assert.deepEqual(activity.entities[0].keywords, ['PreChatMessage']);
  assert.equal(activity.entities[0].author.name, 'How can I help?');
  assert.ok(activity.entities[0].author.image.startsWith('data:image/svg+xml,'));
  assert.equal(activity.channelData['webchat:sequence-id'], -1);
  assert.deepEqual(activity.suggestedActions.to, []);
  assert.deepEqual(activity.suggestedActions.actions, [
    { type: 'messageBack', title: 'Get started', text: 'What can you help me with?' }
  ]);
  const withoutFiles = createPreChatActivity(configuration({ enableFileUpload: false, starterPrompts: [] }));
  assert.equal(withoutFiles.entities[0].author.description, 'Ask a question to get started.');
  assert.deepEqual(withoutFiles.suggestedActions.actions, []);
});

for (const showReasoning of [false, true]) {
  for (const showToolCalls of [false, true]) {
    test(`native groups respect reasoning=${showReasoning}, tools=${showToolCalls} without exposing raw events`, () => {
      const adapter = new NativeActivityAdapter(configuration({ showReasoning, showToolCalls }));
      adapter.startTurn();
      const activities = [
        ...adapter.transform(thought('Checking sources')),
        ...adapter.transform(tool('DynamicPlanReceived', {
          toolDefinitions: [{ schemaName: 'lookup', displayName: 'Search reference material' }]
        })),
        ...adapter.transform(tool('DynamicPlanStepTriggered', { arguments: 'PRIVATE_ARGUMENT', thought: 'PRIVATE_THOUGHT' })),
        ...adapter.transform(tool('DynamicPlanStepBindUpdate', { arguments: 'PRIVATE_BINDING' })),
        ...adapter.transform(tool('DynamicPlanStepFinished', { result: 'PRIVATE_RESULT' }))
      ];
      assert.equal(activities.length, Number(showReasoning) + Number(showToolCalls) * 2);
      assert.ok(!JSON.stringify(activities).includes('PRIVATE_'));
      for (const activity of activities) {
        assert.equal(activity.type, 'message');
        assert.equal(activity.entities[0]['@id'], '');
        assert.equal(activity.entities[0].isPartOf['@type'], 'HowTo');
        assert.ok(activity.entities[0].keywords.includes('Collapsible'));
        assert.ok(!('value' in activity));
      }
      if (showToolCalls) {
        const last = activities[activities.length - 1];
        assert.equal(last.entities[0].abstract, 'Search reference material');
        assert.equal(last.text, 'Finished');
      }
    });
  }
}

test('native progress updates keep their IDs and order, finish once, and do not overwrite another turn', () => {
  const adapter = new NativeActivityAdapter(configuration({ showReasoning: true }));
  adapter.startTurn();
  const [first] = adapter.transform(thought('Checking'));
  const [second] = adapter.transform(thought('Checking sources', 2, 'replace'));
  assert.equal(first.id, second.id);
  assert.equal(typeof first.timestamp, 'string');
  assert.equal(first.timestamp, second.timestamp);
  assert.equal(first.channelData['webchat:sequence-id'], 1);
  assert.equal(first.channelData['webchat:sequence-id'], second.channelData['webchat:sequence-id']);
  assert.equal(second.text, 'Checking sources');
  assert.deepEqual(adapter.transform(thought('old', 1)), []);
  const [finished] = adapter.transform({ type: 'event', name: 'turn.complete' });
  assert.equal(finished.id, first.id);
  assert.equal(finished.entities[0].creativeWorkStatus, 'Published');
  assert.equal(finished.entities[0].isPartOf.creativeWorkStatus, 'Published');
  assert.deepEqual(adapter.finishTurn(), []);
  adapter.startTurn();
  const [nextTurn] = adapter.transform(thought('Checking again'));
  assert.notEqual(nextTurn.id, first.id);
  assert.notEqual(nextTurn.entities[0].isPartOf['@id'], first.entities[0].isPartOf['@id']);
});

test('ordinary replies remain untouched and native analysis respects the reasoning flag', () => {
  const adapter = new NativeActivityAdapter(configuration());
  const reply = { type: 'message', text: 'The answer', from: { id: 'bot', role: 'bot' } };
  assert.strictEqual(adapter.transform(reply)[0], reply);
  const analysis = { ...reply, entities: [{ type: 'https://schema.org/Message', keywords: ['AnalysisMessage'] }] };
  assert.deepEqual(adapter.transform(analysis), []);
  assert.strictEqual(new NativeActivityAdapter(configuration({ showReasoning: true })).transform(analysis)[0], analysis);
});

test('turn completion does not invent a tool-finished event', () => {
  const adapter = new NativeActivityAdapter(configuration({ showToolCalls: true }));
  adapter.transform(tool('DynamicPlanStepTriggered'));
  const [finished] = adapter.finishTurn();
  assert.equal(finished.text, 'No finish event received.');
  assert.equal(finished.entities[0].creativeWorkStatus, undefined);
});

test('toolCall metadata produces a named native tool step, not a Reasoning step', () => {
  const adapter = new NativeActivityAdapter(configuration({ showToolCalls: true }));
  const [started] = adapter.transform(toolCall('started'));
  const [finished] = adapter.transform(toolCall('completed'));
  assert.equal(started.id, finished.id);
  assert.equal(started.channelData['webchat:sequence-id'], finished.channelData['webchat:sequence-id']);
  assert.equal(finished.entities[0].abstract, 'Get items');
  assert.equal(finished.text, 'Finished');
  assert.equal(finished.entities[0].creativeWorkStatus, 'Published');
  assert.ok(!JSON.stringify([started, finished]).includes('PRIVATE_'));
});

test('failed toolCall entities remain failed when the turn finishes', () => {
  const adapter = new NativeActivityAdapter(configuration({ showToolCalls: true }));
  adapter.transform(toolCall('started'));
  const [failed] = adapter.transform(toolCall('failed'));
  const [finished] = adapter.finishTurn();
  assert.equal(failed.text, 'Failed');
  assert.equal(failed.entities[0].creativeWorkStatus, 'Failed');
  assert.equal(finished.text, 'Failed');
  assert.equal(finished.entities[0].creativeWorkStatus, 'Failed');
});

test('unclassified informative updates are not mislabeled or replayed into the transcript', () => {
  const adapter = new NativeActivityAdapter(configuration({ showReasoning: true, showToolCalls: true }));
  assert.deepEqual(adapter.transform({ type: 'typing', text: 'Working', channelData: { streamType: 'informative' } }), []);
  assert.deepEqual(adapter.transform({
    type: 'typing', text: 'Working', entities: [{ type: 'streaminfo', streamType: 'informative' }]
  }), []);
});
