const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyActivityDetails, updateActivityDetails } = require('../temp/tests/components/Chat/activityDetails');
const { thought, toolCall } = require('./fixtures/sdkActivities.cjs');
const tool = (valueType, value = {}) => ({ type: 'event', valueType, value: { taskDialogId: 'lookup', stepId: 'call1', ...value } });
const visible = { showReasoning: true, showToolCalls: true };

for (const showReasoning of [false, true]) {
  for (const showToolCalls of [false, true]) {
    test(`independent visibility: reasoning=${showReasoning}, tools=${showToolCalls}`, () => {
      const flags = { showReasoning, showToolCalls };
      let state = updateActivityDetails(emptyActivityDetails(), thought('Checking sources', 1), flags);
      state = updateActivityDetails(state, tool('DynamicPlanStepTriggered'), flags);
      assert.equal(state.entries.filter(e => e.kind === 'reasoning').length, Number(showReasoning));
      assert.equal(state.entries.filter(e => e.kind === 'tool').length, Number(showToolCalls));
    });
  }
}
test('cumulative text replaces, explicit deltas append, duplicate/old sequences are ignored', () => {
  let state = emptyActivityDetails();
  for (const activity of [
    thought('Checking', 1), thought('Checking sources', 2, 'replace'),
    thought(' now', 3, 'delta'), thought(' duplicate', 3, 'delta'), thought('old', 1)
  ]) state = updateActivityDetails(state, activity, visible);
  assert.equal(state.entries.length, 1);
  assert.equal(state.entries[0].text, 'Checking sources now');
});
test('thought deltas use entity text and the initial activity ID, then a replacement snapshot replaces the accumulated text', () => {
  let state = emptyActivityDetails();
  for (const activity of [thought('Check ', 1), thought('the list', 2), thought('Check the list', 3, 'replace')]) {
    state = updateActivityDetails(state, activity, visible);
  }
  assert.equal(state.entries.length, 1);
  assert.equal(state.entries[0].id, 'reasoning:answer-stream:0');
  assert.equal(state.entries[0].text, 'Check the list');
});
test('separate thought chains and sequence numbers do not share accumulated text', () => {
  let state = emptyActivityDetails();
  for (const properties of [
    { chainOfThoughtId: 'chain-a', sequenceNumber: 0 },
    { chainOfThoughtId: 'chain-a', sequenceNumber: 1 },
    { chainOfThoughtId: 'chain-b', sequenceNumber: 0 }
  ]) state = updateActivityDetails(state, thought('Check', 1, 'delta', properties), visible);
  assert.equal(state.entries.length, 3);
  assert.ok(state.entries.every(entry => entry.text === 'Check'));
});
test('toolCall entities correlate by call ID even when multiple calls share a stream and tool name', () => {
  let state = emptyActivityDetails();
  for (const activity of [
    toolCall('started', { toolCallId: 'first', streamSequence: 1 }),
    toolCall('started', { toolCallId: 'second', streamSequence: 2 }),
    toolCall('completed', { toolCallId: 'first', streamSequence: 3 }),
    toolCall('started', { toolCallId: 'first', streamSequence: 4 }),
    toolCall('started', { toolCallId: 'second', streamSequence: 1 })
  ]) state = updateActivityDetails(state, activity, visible);
  assert.deepEqual(state.entries.map(({ id, kind, text, status }) => ({ id, kind, text, status })), [
    { id: 'tool:first', kind: 'tool', text: 'Get items', status: 'finished' },
    { id: 'tool:second', kind: 'tool', text: 'Get items', status: 'running' }
  ]);
  assert.ok(!JSON.stringify(state).includes('PRIVATE_'));
});
test('untyped informative messages, malformed tool entities and unknown tool status do not become reasoning or tool calls', () => {
  const state = emptyActivityDetails();
  for (const activity of [
    { type: 'typing', text: 'Get items completed', channelData: { streamType: 'informative' } },
    { type: 'typing', text: 'Working', entities: [{ type: 'streaminfo', streamType: 'informative' }] },
    { type: 'typing', entities: [{ type: 'thought', text: { private: true } }] },
    toolCall('started', { toolCallId: '' }), toolCall('unknown')
  ]) assert.strictEqual(updateActivityDetails(state, activity, visible), state);
});
test('entity-only stream metadata retains ordering and correlates the thought stream', () => {
  const first = thought('Check', 1, 'replace');
  const second = thought('Check the list', 2, 'replace');
  delete first.channelData;
  delete second.channelData;
  let state = updateActivityDetails(emptyActivityDetails(), first, visible);
  state = updateActivityDetails(state, second, visible);
  assert.equal(state.entries.length, 1);
  assert.equal(state.entries[0].text, 'Check the list');
  assert.equal(state.entries[0].sequence, 2);
});
test('tool names and lifecycle are shown without arguments, outputs or thought payloads', () => {
  let state = updateActivityDetails(emptyActivityDetails(), tool('DynamicPlanReceived', {
    toolDefinitions: [{ schemaName: 'lookup', displayName: 'Look up a record' }]
  }), visible);
  state = updateActivityDetails(state, tool('DynamicPlanStepTriggered', { thought: 'private', arguments: { secret: 'hidden' } }), visible);
  state = updateActivityDetails(state, tool('DynamicPlanStepFinished', { output: 'hidden' }), visible);
  state = updateActivityDetails(state, tool('DynamicPlanStepTriggered'), visible);
  assert.equal(state.entries[0].text, 'Look up a record');
  assert.equal(state.entries[0].status, 'finished');
  assert.ok(!JSON.stringify(state).includes('hidden'));
  assert.ok(!JSON.stringify(state).includes('private'));
});
test('ordinary answer streaming, malformed, and unknown events do not become reasoning or tools', () => {
  const state = emptyActivityDetails();
  for (const activity of [null, {}, 'bad', { type: 'typing', text: 'answer', channelData: { streamType: 'streaming' } },
    tool('unknown'), { type: 'message', text: 'Final answer' }]) {
    assert.strictEqual(updateActivityDetails(state, activity, visible), state);
  }
  assert.deepEqual(emptyActivityDetails().entries, []);
});

test('numeric step IDs preserve separate invocations of the same tool', () => {
  let state = emptyActivityDetails();
  for (const stepId of [0, 1]) {
    state = updateActivityDetails(state, tool('DynamicPlanStepTriggered', { stepId }), visible);
  }
  state = updateActivityDetails(state, tool('DynamicPlanStepFinished', { stepId: 0 }), visible);
  assert.deepEqual(state.entries.map(({ id, status }) => ({ id, status })), [
    { id: 'tool:0', status: 'finished' }, { id: 'tool:1', status: 'running' }
  ]);
});

test('unknown tool names cannot resolve to inherited object properties', () => {
  const state = updateActivityDetails(emptyActivityDetails(), tool('DynamicPlanStepTriggered', {
    taskDialogId: 'toString'
  }), visible);
  assert.equal(state.entries[0].text, 'toString');
});
