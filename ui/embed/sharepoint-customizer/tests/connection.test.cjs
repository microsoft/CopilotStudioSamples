const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const { Observable, BehaviorSubject, Subject, take } = require('rxjs');
const { Activity } = require('@microsoft/agents-activity');
const { CopilotStudioWebChat } = require('@microsoft/agents-copilotstudio-client');
const { createConnection, wrapConnection } = require('../temp/tests/components/Chat/createConnection');
const { normalizeConfiguration } = require('../temp/tests/configuration');

function fixture(postActivity, visibility = {}, initializeConversation) {
  const received = new Subject();
  const failures = [];
  let starts = 0;
  let ends = 0;
  let subscriptions = 0;
  const base = {
    connectionStatus$: new BehaviorSubject(2),
    activity$: new Observable(subscriber => {
      subscriptions++;
      return received.subscribe(subscriber);
    }),
    postActivity,
    end() { received.complete(); },
    conversationId: undefined
  };
  const connection = wrapConnection(base, {
    startConversation: false, enableFileUpload: true, showTyping: false,
    showReasoning: false, showToolCalls: false, starterPrompts: [], ...visibility
  }, {
    onError(error) { failures.push(error.message); },
    onTurn() { starts++; },
    onTurnEnd() { ends++; }
  }, initializeConversation);
  return { connection, received, failures, counts: () => ({ starts, ends, subscriptions }) };
}

test('both opening modes pass their startConversation setting to the SDK', () => {
  const base = {
    activity$: new Subject(), connectionStatus$: new BehaviorSubject(2),
    postActivity: () => new Observable(), end() {}
  };
  const create = mock.method(CopilotStudioWebChat, 'createConnection', () => base);
  try {
    for (const startConversation of [undefined, true, false]) {
      const configuration = normalizeConfiguration({
        appClientId: 'client', tenantId: 'tenant', environmentId: 'environment', schemaName: 'agent', startConversation
      });
      const connection = createConnection({}, configuration, { onTurn() {}, onTurnEnd() {}, onError() {} });
      assert.deepEqual(create.mock.calls.at(-1).arguments[1], { showTyping: true, startConversation: startConversation === true });
      connection.end();
    }
  } finally {
    create.mock.restore();
  }
});

test('automatic start hides local starter cards without dropping the agent greeting', () => {
  const f = fixture(() => new Observable(), { startConversation: true });
  const visible = [];
  const subscription = f.connection.activity$.subscribe(activity => visible.push(activity));
  assert.deepEqual(visible, []);
  f.received.next({ type: 'message', id: 'greeting', text: 'Welcome from the agent' });
  assert.deepEqual(visible.map(activity => activity.text), ['Welcome from the agent']);
  subscription.unsubscribe();
  f.connection.end();
});

test('response errors are still observed after WebChat takes the first send acknowledgement', async () => {
  let response;
  const f = fixture(() => new Observable(subscriber => {
    response = subscriber;
    subscriber.next('sent-id');
  }));
  const acknowledgements = [];
  f.connection.postActivity(new Activity('message')).pipe(take(1)).subscribe(id => acknowledgements.push(id));
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(acknowledgements, ['sent-id']);
  assert.equal(response.closed, false);
  response.error(new Error('Service response failed'));
  assert.deepEqual(f.failures, ['Service response failed']);
  assert.equal(f.counts().ends, 1);
  f.connection.end();
});

test('single incoming subscription filters private detail events but preserves answer streaming', () => {
  const f = fixture(() => new Observable());
  const visible = [];
  const subscription = f.connection.activity$.subscribe(activity => visible.push(activity));
  f.received.next({ type: 'typing', text: 'private progress', channelData: { streamType: 'informative' } });
  f.received.next({ type: 'event', valueType: 'DynamicPlanStepTriggered', value: { arguments: 'private' } });
  f.received.next({ type: 'typing' });
  f.received.next({ type: 'typing', text: 'Partial answer', channelData: { streamType: 'streaming' } });
  f.received.next({ type: 'message', id: 'final', text: 'Final answer' });
  assert.equal(f.counts().subscriptions, 1);
  assert.deepEqual(visible.map(activity => activity.text), ['', 'Partial answer', 'Final answer']);
  subscription.unsubscribe();
  f.connection.end();
});

test('ending the connection prevents late activity and releases outstanding response subscriptions', async () => {
  let response;
  const f = fixture(() => new Observable(subscriber => {
    response = subscriber;
    subscriber.next('sent');
  }));
  f.connection.postActivity(new Activity('message')).pipe(take(1)).subscribe();
  await new Promise(resolve => setImmediate(resolve));
  f.connection.end();
  assert.equal(response.closed, true);
  response.error(new Error('Late failure'));
  assert.deepEqual(f.failures, []);
});

test('startup messages are replayed to the transcript with one SDK subscription and no private replay', () => {
  const f = fixture(() => new Observable());
  const startup = f.connection.activity$.subscribe();
  f.received.next({ type: 'message', text: 'Welcome' });
  f.received.next({ type: 'typing', text: 'Progress', channelData: { streamType: 'informative' } });
  f.received.next({ type: 'event', name: 'turn.complete' });
  const transcript = [];
  const subscription = f.connection.activity$.subscribe(activity => transcript.push(activity));
  assert.equal(f.counts().subscriptions, 1);
  assert.deepEqual(transcript.map(activity => activity.text), ['', 'Welcome']);
  assert.ok(transcript[0].id);
  assert.ok(transcript[1].id);
  startup.unsubscribe();
  f.received.next({ type: 'message', text: 'Still connected' });
  assert.equal(transcript.length, 3);
  subscription.unsubscribe();
  f.connection.end();
});

test('native activity groups finish when the SDK response completes without a turn.complete event', async () => {
  let response;
  const f = fixture(() => new Observable(subscriber => {
    response = subscriber;
    subscriber.next('sent-id');
  }), { showReasoning: true });
  const visible = [];
  const subscription = f.connection.activity$.subscribe(activity => visible.push(activity));
  f.connection.postActivity(new Activity('message')).pipe(take(1)).subscribe();
  await new Promise(resolve => setImmediate(resolve));
  f.received.next({
    type: 'typing', entities: [{ type: 'thought', text: 'Checking the request', sequenceNumber: 0 }],
    channelData: { streamType: 'streaming', streamId: 'thought-stream', streamSequence: 1, chunkType: 'delta' }
  });
  response.complete();
  const details = visible.filter(activity => activity.id.includes(':reasoning:'));
  assert.equal(details.length, 2);
  assert.equal(details[0].entities[0].isPartOf.creativeWorkStatus, 'Incomplete');
  assert.equal(details[1].entities[0].isPartOf.creativeWorkStatus, 'Published');
  assert.equal(details[0].id, details[1].id);
  subscription.unsubscribe();
  f.connection.end();
});

test('response failure stops native progress without claiming success', async () => {
  let response;
  const f = fixture(() => new Observable(subscriber => {
    response = subscriber;
    subscriber.next('sent-id');
  }), { showToolCalls: true });
  const visible = [];
  const subscription = f.connection.activity$.subscribe(activity => visible.push(activity));
  f.connection.postActivity(new Activity('message')).pipe(take(1)).subscribe();
  await new Promise(resolve => setImmediate(resolve));
  f.received.next({ type: 'event', valueType: 'DynamicPlanStepTriggered', value: { taskDialogId: 'lookup', stepId: 1 } });
  response.error(new Error('Response interrupted'));
  const last = visible[visible.length - 1];
  assert.equal(last.entities[0].isPartOf.creativeWorkStatus, 'Failed');
  assert.equal(last.entities[0].creativeWorkStatus, undefined);
  assert.equal(last.text, 'No finish event received.');
  assert.deepEqual(f.failures, ['Response interrupted']);
  subscription.unsubscribe();
  f.connection.end();
});

test('cancellation before acknowledgment releases the busy state and response subscription', async () => {
  let response;
  const f = fixture(() => new Observable(subscriber => { response = subscriber; }));
  const subscription = f.connection.postActivity(new Activity('message')).subscribe();
  await new Promise(resolve => setImmediate(resolve));
  subscription.unsubscribe();
  assert.equal(response.closed, true);
  assert.deepEqual(f.counts(), { starts: 1, ends: 1, subscriptions: 0 });
  f.connection.end();
});

test('synchronous send failures are surfaced and release the busy state', async () => {
  const f = fixture(() => { throw new Error('Cannot send'); });
  const failures = [];
  f.connection.postActivity(new Activity('message')).subscribe({ error: error => failures.push(error.message) });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(failures, ['Cannot send']);
  assert.deepEqual(f.failures, ['Cannot send']);
  assert.equal(f.counts().ends, 1);
  f.connection.end();
});

test('startup failures use DirectLine failed status instead of an unhandled observable error', () => {
  const f = fixture(() => new Observable());
  let completed = false;
  f.connection.activity$.subscribe({ complete: () => { completed = true; } });
  f.received.error(new Error('Discovery unavailable'));
  assert.deepEqual(f.failures, ['Discovery unavailable']);
  assert.equal(f.connection.connectionStatus$.value, 4);
  assert.equal(completed, true);
  f.connection.end();
});

test('attachment preparation holds busy state and cancellation prevents a late send', async t => {
  let resolveRead;
  t.mock.method(globalThis, 'fetch', () => new Promise(resolve => { resolveRead = resolve; }));
  let sends = 0;
  const f = fixture(() => { sends++; return new Observable(); });
  const subscription = f.connection.postActivity({
    type: 'message', attachments: [{ name: 'notes.txt', contentType: 'text/plain', contentUrl: 'blob:pending' }]
  }).subscribe();
  assert.equal(f.counts().starts, 1);
  subscription.unsubscribe();
  assert.equal(f.counts().ends, 1);
  resolveRead(new Response('fixture'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(sends, 0);
  assert.deepEqual(f.failures, []);
  f.connection.end();
});

test('attachment validation failure is reported and releases busy state without sending', async () => {
  let initialized = false;
  const f = fixture(() => { throw new Error('Must not send'); }, {}, async () => { initialized = true; });
  f.connection.postActivity({
    type: 'message', attachments: [{ name: 'notes.txt', contentType: 'text/plain', contentUrl: 'https://example.com/file' }]
  }).subscribe({ error() {} });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.counts().ends, 1);
  assert.equal(initialized, false);
  assert.match(f.failures[0], /local file/);
  f.connection.end();
});

test('lazy initialization failure is reported and releases busy state without sending the message', async () => {
  let sends = 0;
  const f = fixture(() => { sends++; return new Observable(); }, {}, async () => { throw new Error('Cannot create conversation'); });
  const failures = [];
  f.connection.postActivity(new Activity('message')).subscribe({ error: error => failures.push(error.message) });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(failures, ['Cannot create conversation']);
  assert.deepEqual(f.failures, failures);
  assert.equal(f.counts().ends, 1);
  assert.equal(sends, 0);
  f.connection.end();
});

for (const closeConnection of [false, true]) {
  test(`cancellation during lazy initialization prevents a late send (closeConnection=${closeConnection})`, async () => {
    let initialize;
    let sends = 0;
    const f = fixture(() => { sends++; return new Observable(); }, {}, () => new Promise(resolve => { initialize = resolve; }));
    const subscription = f.connection.postActivity(new Activity('message')).subscribe();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(f.counts().starts, 1);
    if (closeConnection) f.connection.end();
    else subscription.unsubscribe();
    initialize();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(sends, 0);
    assert.deepEqual(f.failures, []);
    subscription.unsubscribe();
    f.connection.end();
  });
}
