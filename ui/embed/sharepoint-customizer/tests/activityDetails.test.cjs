const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyActivityDetails, updateActivityDetails } = require('../temp/tests/components/Chat/activityDetails');
const { thought, toolCall, standardPlan, standardStep } = require('./fixtures/sdkActivities.cjs');
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
test('tool names and lifecycle exclude arguments and outputs while step reasoning has its own entry', () => {
  let state = updateActivityDetails(emptyActivityDetails(), tool('DynamicPlanReceived', {
    toolDefinitions: [{ schemaName: 'lookup', displayName: 'Look up a record' }]
  }), visible);
  state = updateActivityDetails(state, tool('DynamicPlanStepTriggered', { thought: 'Look up the requested record.', arguments: { secret: 'hidden' } }), visible);
  state = updateActivityDetails(state, tool('DynamicPlanStepFinished', { output: 'hidden' }), visible);
  state = updateActivityDetails(state, tool('DynamicPlanStepTriggered'), visible);
  assert.equal(state.entries.find(entry => entry.kind === 'tool').text, 'Look up a record');
  assert.equal(state.entries.find(entry => entry.kind === 'tool').status, 'finished');
  assert.equal(state.entries.find(entry => entry.kind === 'reasoning').text, 'Look up the requested record.');
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
    { id: 'tool:standard:["","0"]', status: 'finished' }, { id: 'tool:standard:["","1"]', status: 'running' }
  ]);
});

test('unknown tool names cannot resolve to inherited object properties', () => {
  const state = updateActivityDetails(emptyActivityDetails(), tool('DynamicPlanStepTriggered', {
    taskDialogId: 'toString'
  }), visible);
  assert.equal(state.entries[0].text, 'toString');
});

for (const showReasoning of [false, true]) {
  for (const showToolCalls of [false, true]) {
    test(`standard mapping is independent: reasoning=${showReasoning}, tools=${showToolCalls}`, () => {
      const flags = { showReasoning, showToolCalls };
      let state = emptyActivityDetails();
      for (const activity of [
        standardPlan(),
        standardStep('DynamicPlanStepTriggered', { thought: 'Check the weather for the requested city.', state: 'inProgress' }),
        standardStep('DynamicPlanStepBindUpdate', { arguments: { Location: 'PRIVATE_CITY' }, thought: 'PRIVATE_BIND_THOUGHT' }),
        standardStep('DynamicPlanStepFinished', { result: 'PRIVATE_RESULT', thought: 'PRIVATE_FINISH_THOUGHT' })
      ]) state = updateActivityDetails(state, activity, flags);
      assert.equal(state.entries.filter(entry => entry.kind === 'reasoning').length, Number(showReasoning));
      assert.equal(state.entries.filter(entry => entry.kind === 'tool').length, Number(showToolCalls));
      if (showReasoning) assert.equal(state.entries.find(entry => entry.kind === 'reasoning').text, 'Check the weather for the requested city.');
      if (showToolCalls) {
        assert.equal(state.entries.find(entry => entry.kind === 'tool').text, 'Get current weather');
        assert.equal(state.entries.find(entry => entry.kind === 'tool').status, 'finished');
      }
      assert.ok(!JSON.stringify(state).includes('PRIVATE_'));
    });
  }
}

test('standard step snapshots replace, deduplicate, and stay separate across steps and plans', () => {
  let state = updateActivityDetails(emptyActivityDetails(), standardStep('DynamicPlanStepTriggered', { thought: 'Check Seattle.' }), visible);
  const same = updateActivityDetails(state, standardStep('DynamicPlanStepTriggered', { thought: 'Check Seattle.' }), visible);
  assert.strictEqual(same, state);
  state = updateActivityDetails(state, standardStep('DynamicPlanStepTriggered', { thought: 'Check Seattle in metric units.' }), visible);
  state = updateActivityDetails(state, standardStep('DynamicPlanStepTriggered', { stepId: 'second', thought: 'Check London.' }), visible);
  state = updateActivityDetails(state, standardStep('DynamicPlanStepTriggered', { planIdentifier: 'another-plan', thought: 'Check Paris.' }), visible);
  assert.deepEqual(state.entries.filter(entry => entry.kind === 'reasoning').map(entry => entry.text),
    ['Check Seattle in metric units.', 'Check London.', 'Check Paris.']);
  assert.equal(new Set(state.entries.map(entry => entry.id)).size, 6);
});

test('standard event names are accepted when valueType is absent, but arbitrary thought fields are not', () => {
  const event = standardStep('DynamicPlanStepTriggered', { thought: 'Check the weather.' });
  delete event.valueType;
  const state = updateActivityDetails(emptyActivityDetails(), event, visible);
  assert.equal(state.entries.length, 2);
  for (const activity of [
    { type: 'message', name: event.name, value: event.value },
    { type: 'event', name: 'UnknownEvent', value: event.value },
    standardStep('DynamicPlanStepTriggered', { thought: { text: 'PRIVATE_NESTED' } }),
    standardStep('DynamicPlanStepTriggered', { thought: '   ' }),
    standardStep('DynamicPlanStepTriggered', { thought: 'Uncorrelated', stepId: '', taskDialogId: '' })
  ]) {
    const next = updateActivityDetails(emptyActivityDetails(), activity, { showReasoning: true, showToolCalls: false });
    assert.deepEqual(next.entries, []);
  }
});

test('standard binding updates identify an ongoing tool step without exposing inputs or inventing completion', () => {
  let state = updateActivityDetails(emptyActivityDetails(), standardPlan(), visible);
  state = updateActivityDetails(state, standardStep('DynamicPlanStepBindUpdate', { arguments: { Location: 'PRIVATE_CITY' } }), visible);
  assert.deepEqual(state.entries.map(({ kind, text, status }) => ({ kind, text, status })),
    [{ kind: 'tool', text: 'Get current weather', status: 'running' }]);
  state = updateActivityDetails(state, standardStep('DynamicPlanStepFinished'), visible);
  const late = updateActivityDetails(state, standardStep('DynamicPlanStepBindUpdate'), visible);
  assert.strictEqual(late, state);
  assert.equal(state.entries[0].status, 'finished');
});

test('standard correlation keeps opaque plan and step identifiers distinct', () => {
  let state = emptyActivityDetails();
  for (const [planIdentifier, stepId] of [['a:b', 'c'], ['a', 'b:c'], ['plan', '\uD800']]) {
    state = updateActivityDetails(state, standardStep('DynamicPlanStepTriggered', { planIdentifier, stepId }), visible);
  }
  assert.equal(new Set(state.entries.map(entry => entry.id)).size, 3);
});
