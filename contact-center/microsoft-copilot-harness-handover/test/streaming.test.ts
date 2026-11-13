import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { Activity } from '@microsoft/agents-activity';
import { ConnectionSettings, CopilotStudioClient } from '@microsoft/agents-copilotstudio-client';
import { AgentApplication, MemoryStorage, TurnContext, UserTokenClient } from '@microsoft/agents-hosting';
import { ChannelStream } from '../src/channel-stream.js';
import { Channels } from '../src/channels.js';
import { hash, Relay, type Studio, type StudioEvent } from '../src/relay.js';
import { forwardStudioStream, SdkStudio } from '../src/studio.js';
import { MemoryBackend, Repository } from '../src/store.js';

const chunk = (id: string, sequence: number, text: string) => Activity.fromObject({
  type: 'typing', text, conversation: { id: 'studio' },
  entities: [{ type: 'streaminfo', streamType: 'streaming', streamId: id, streamSequence: sequence }]
});
const final = (id: string, text: string) => Activity.fromObject({
  type: 'message', text, conversation: { id: 'studio' },
  entities: [{ type: 'streaminfo', streamType: 'final', streamId: id }]
});

test('slow channel delivery cannot block reading the Studio stream or drop its final answer', { timeout: 1500 }, async t => {
  const settings = new ConnectionSettings({ environmentId: 'environment', schemaName: 'agent' });
  const client = new CopilotStudioClient(settings, 'test-token');
  let drained!: () => void;
  const upstreamComplete = new Promise<void>(resolve => { drained = resolve; });
  t.mock.method(client, 'executeStreaming', async function* (activity, conversationId) {
    assert.equal(conversationId, 'studio');
    assert.equal(activity.conversation?.id, 'studio');
    yield Activity.fromObject({ type: 'typing' });
    yield chunk('answer', 1, 'Hello');
    yield final('answer', 'Hello, world');
    drained();
  });
  t.mock.method(console, 'log', () => {});
  const events: StudioEvent[] = [];
  const studio = new SdkStudio(settings, 'test-token', client);
  await studio.send('studio', 'Hi', 'request', async event => {
    if (event.type === 'typing') await upstreamComplete;
    events.push(event);
  });
  assert.deepEqual(events.map(event => event.type), ['typing', 'partial', 'message']);
  await assert.rejects(studio.send('studio', 'Hi', 'another-request', async () => {
    throw new Error('Teams delivery failed');
  }), /Teams delivery failed/);
});

test('Studio forwards typing and accumulated answer snapshots before completion, without thought text or duplicate finals', async () => {
  const events: StudioEvent[] = [];
  async function* activities() {
    yield Activity.fromObject({ type: 'typing' });
    assert.deepEqual(events, [{ type: 'typing' }]);
    yield chunk('answer', 1, 'Hel');
    yield chunk('answer', 2, 'Hello');
    yield chunk('answer', 2, 'duplicate');
    const thought = chunk('reasoning', 1, 'Private reasoning');
    thought.entities!.push({ type: 'thought' });
    yield thought;
    const thoughtFinal = final('reasoning', 'Private final reasoning');
    thoughtFinal.entities!.push({ type: 'thought' });
    yield thoughtFinal;
    yield final('answer', 'Hello, world');
    assert.equal(events.at(-1)?.type, 'message', 'the final is delivered before the SSE response ends');
    yield final('answer', 'Hello, world');
    yield Activity.fromObject({ type: 'typing', text: 'Post-answer orchestration' });
  }
  await forwardStudioStream(activities(), 'studio', 'request', async event => { events.push(event); });
  assert.deepEqual(events.filter(e => e.type === 'partial').map(e => e.text), ['Hel', 'Hello']);
  const messages = events.filter(e => e.type === 'message');
  assert.equal(messages.length, 1);
  assert.equal(messages[0]!.text, 'Hello, world');
  assert.equal(messages[0]!.id, events.find(e => e.type === 'partial')!.id);
  assert.doesNotMatch(JSON.stringify(events), /reasoning|duplicate|Post-answer/);
});

test('thought metadata does not hide public chunks and the final answer on the same Studio stream', async () => {
  const events: StudioEvent[] = [];
  async function* activities() {
    const thought = chunk('shared', 1, '');
    thought.entities!.push({ type: 'thought', text: 'Private reasoning that must not be forwarded' });
    yield thought;
    yield chunk('shared', 2, 'The support ');
    const moreThought = chunk('shared', 3, '');
    moreThought.entities!.push({ type: 'thought', title: 'Private tool deliberation' });
    yield moreThought;
    yield chunk('shared', 4, 'The support exchange is complete.');
    yield final('shared', 'The support exchange is complete. How can I help?');
  }
  await forwardStudioStream(activities(), 'studio', 'request', async event => { events.push(event); });
  assert.deepEqual(events.filter(e => e.type === 'partial').map(e => e.text),
    ['The support ', 'The support exchange is complete.']);
  assert.deepEqual(events.filter(e => e.type === 'message').map(e => e.text),
    ['The support exchange is complete. How can I help?']);
  assert.doesNotMatch(JSON.stringify(events), /Private/);
});

test('hidden thought text is never streamed through later accumulated chunks, but an explicit public final is retained', async () => {
  const events: StudioEvent[] = [];
  async function* activities() {
    const thought = chunk('shared', 1, 'Private reasoning.');
    thought.entities!.push({ type: 'thought' });
    yield thought;
    yield chunk('shared', 2, 'Private reasoning.Public answer.');
    yield final('shared', 'Public answer.');
  }
  await forwardStudioStream(activities(), 'studio', 'request', async event => { events.push(event); });
  assert.equal(events.some(e => e.type === 'partial'), false);
  assert.deepEqual(events.filter(e => e.type === 'message').map(e => e.text), ['Public answer.']);
  assert.doesNotMatch(JSON.stringify(events), /Private/);
});

test('Studio supports legacy stream metadata and stream-only completion, but never finalizes a failed or cross-conversation stream', async () => {
  const events: StudioEvent[] = [];
  async function* legacy() {
    yield Activity.fromObject({
      type: 'typing', text: 'Legacy answer',
      channelData: { streamType: 'streaming', streamId: 'legacy', streamSequence: 1 }
    });
  }
  await forwardStudioStream(legacy(), 'studio', 'request', async event => { events.push(event); });
  assert.deepEqual(events.map(e => e.type), ['partial', 'message']);
  for (const mismatch of [false, true]) {
    const failed: StudioEvent[] = [];
    async function* broken() {
      yield chunk('answer', 1, 'Partial');
      if (!mismatch) throw new Error('SSE disconnected');
      const wrong = final('answer', 'Must not route');
      wrong.conversation!.id = 'another-studio-conversation';
      yield wrong;
    }
    await assert.rejects(forwardStudioStream(broken(), 'studio', 'request', async event => { failed.push(event); }),
      mismatch ? /changed the conversation ID/ : /disconnected/);
    assert.equal(failed.some(e => e.type === 'message'), false);
  }
});

test('plain final replies stay distinct and unrelated requests cannot share a stream ID', async () => {
  async function* activities() {
    yield Activity.fromObject({ type: 'message', id: 'one', text: 'First' });
    yield Activity.fromObject({ type: 'message', id: 'one', text: 'First' });
    yield Activity.fromObject({ type: 'message', id: 'two', text: 'Second' });
  }
  const first: StudioEvent[] = [], second: StudioEvent[] = [];
  await forwardStudioStream(activities(), 'studio', 'request-one', async event => { first.push(event); });
  await forwardStudioStream(activities(), 'studio', 'request-two', async event => { second.push(event); });
  assert.deepEqual(first.filter(e => e.type === 'message').map(e => e.text), ['First', 'Second']);
  assert.notDeepEqual(first, second);
});

test('a contentless final stream marker completes the answer immediately', async () => {
  const events: StudioEvent[] = [];
  async function* activities() {
    yield chunk('answer', 1, 'Complete streamed answer');
    yield Activity.fromObject({
      type: 'typing', entities: [{ type: 'streaminfo', streamType: 'final', streamId: 'answer' }]
    });
    assert.equal(events.at(-1)?.type, 'message');
  }
  await forwardStudioStream(activities(), 'studio', 'request', async event => { events.push(event); });
  assert.deepEqual(events.filter(e => e.type === 'message').map(e => e.text), ['Complete streamed answer']);
});

test('the first ID-less stream metadata chunk is retained when the SDK begins accumulating subsequent chunks', async () => {
  const events: StudioEvent[] = [];
  async function* activities() {
    yield Activity.fromObject({
      type: 'typing', id: 'answer', text: 'Hello ',
      entities: [{ type: 'streaminfo', streamType: 'streaming', streamSequence: 1 }],
      channelData: { streamType: 'streaming', chunkType: 'delta', streamSequence: 1 }
    });
    yield chunk('answer', 2, 'world');
    yield chunk('answer', 3, 'world!');
    yield final('answer', 'Hello world!');
  }
  await forwardStudioStream(activities(), 'studio', 'request', async event => { events.push(event); });
  assert.deepEqual(events.filter(e => e.type === 'partial').map(e => e.text), ['Hello ', 'Hello world', 'Hello world!']);
  assert.deepEqual(events.filter(e => e.type === 'message').map(e => e.text), ['Hello world!']);
});

function channelContext(app: AgentApplication, id = 'customer') {
  return new TurnContext(app.adapter, Activity.fromObject({
    type: 'message', channelId: 'msteams', from: { id }, recipient: { id: 'relay' },
    conversation: { id, conversationType: 'personal' }, serviceUrl: 'https://smba.trafficmanager.net/teams/'
  }));
}

test('Teams streams cumulative snapshots once and replaces revisions with the exact authoritative final', async t => {
  const app = new AgentApplication({ storage: new MemoryStorage() });
  const sent: { type: string; text?: string }[] = [];
  t.mock.method(app.adapter, 'sendActivities', async (_context, activities) => {
    sent.push(...activities.map(a => ({ type: a.type, text: a.text })));
    return activities.map(() => ({ id: 'teams-stream' }));
  });
  const stream = new ChannelStream(channelContext(app));
  stream.update('Hello');
  stream.update('Hello there');
  stream.update('Hello there');
  stream.update('Revised');
  await stream.finish('Revised final answer');
  await stream.finish('Must not send twice');
  assert.equal(sent[0]!.type, 'typing');
  assert.equal(sent[0]!.text, 'Hello');
  assert.deepEqual(sent.filter(a => a.type === 'message').map(a => a.text), ['Revised final answer']);
  assert.equal(sent.some(a => a.text?.includes('thereRevised')), false);
});

test('unsupported Teams streaming falls back to one complete message, but transport failures remain failures', async t => {
  const app = new AgentApplication({ storage: new MemoryStorage() });
  t.mock.method(console, 'warn', () => {});
  const sent: string[] = [];
  const send = t.mock.method(app.adapter, 'sendActivities', async (_context, activities) => {
    if (activities.some(a => a.type === 'typing')) throw new Error('BadArgument: Streaming API is not enabled');
    sent.push(...activities.map(a => a.text!));
    return activities.map(() => ({ id: 'final' }));
  });
  const stream = new ChannelStream(channelContext(app));
  stream.update('Partial');
  await stream.finish('Complete response');
  assert.deepEqual(sent, ['Complete response']);
  send.mock.mockImplementation(async () => { throw new Error('Channel unavailable'); });
  const broken = new ChannelStream(channelContext(app));
  broken.update('Partial');
  await assert.rejects(broken.finish('Final'), /Channel unavailable/);
});

test('final-send errors swallowed by the SDK are surfaced rather than recorded as delivered', async t => {
  const app = new AgentApplication({ storage: new MemoryStorage() });
  t.mock.method(app.adapter, 'sendActivities', async (_context, activities) => {
    if (activities.some(a => a.type === 'message')) throw new Error('Final delivery failed');
    return activities.map(() => ({ id: 'partial' }));
  });
  const stream = new ChannelStream(channelContext(app));
  stream.update('Partial');
  await assert.rejects(stream.finish('Final'), /Final delivery failed/);
});

test('handover closes partial Teams output with the queue notice and suppresses late typing/text without affecting another customer', async t => {
  const app = new AgentApplication({
    storage: new MemoryStorage(),
    authorization: { mcs: { azureBotOAuthConnectionName: 'mcs' } }
  });
  const sent: { customer: string; type: string; text?: string }[] = [];
  t.mock.method(app.adapter, 'continueConversation', async (_id, reference, handler) => {
    await handler(channelContext(app, reference.conversation!.id));
  });
  t.mock.method(app.adapter, 'sendActivities', async (context, activities) => {
    sent.push(...activities.map(a => ({ customer: context.activity.conversation!.id, type: a.type, text: a.text })));
    return activities.map(() => ({ id: `stream-${context.activity.conversation!.id}` }));
  });
  const channels = new Channels(app);
  let relay: Relay;
  const studio: Studio = {
    start: async () => ({ conversationId: crypto.randomUUID(), replies: [] }),
    send: async (id, value, requestId, output) => {
      await output({ type: 'typing' });
      await output({ type: 'partial', id: `reply-${requestId}`, text: 'Partial response' });
      if (value === 'human') {
        await relay.escalate({ conversationId: id, reason: 'Requested human', summary: 'Test' });
        await output({ type: 'typing' });
        await output({ type: 'partial', id: `reply-${requestId}`, text: 'Late partial must not appear' });
        await output({ type: 'message', id: `reply-${requestId}`, text: 'Late final must not appear' });
      } else {
        await output({ type: 'message', id: `reply-${requestId}`, text: 'Other customer answer' });
      }
    }
  };
  relay = new Relay(new Repository(new MemoryBackend()), async () => studio,
    (s, message) => channels.deliver(s, message), (s, update) => channels.progress(s, update));
  channels.attach(relay);
  const a = (await relay.create('a', 'msteams', channelContext(app, 'a').activity.getConversationReference())).session;
  const b = (await relay.create('b', 'msteams', channelContext(app, 'b').activity.getConversationReference())).session;
  await Promise.all([relay.customer(a.id, 'human', 'a-request'), relay.customer(b.id, 'question', 'b-request')]);
  assert.equal((await relay.get(a.id)).mode, 'waiting');
  assert.deepEqual((await relay.get(a.id)).messages.map(m => m.role), ['customer', 'system']);
  assert.equal((await relay.get(b.id)).messages.at(-1)?.text, 'Other customer answer');
  assert.doesNotMatch(JSON.stringify(sent), /Late/);
  assert.deepEqual(sent.filter(a => a.type === 'message').map(a => [a.customer, a.text]).sort(), [
    ['a', 'You are in the support queue. Further messages go to the support agent.'],
    ['b', 'Other customer answer']
  ]);
  assert.equal(sent.filter(a => a.customer === 'a' && a.type === 'typing' && !a.text).length, 1);
});

test('a stream failure never stores partial answer text as a completed transcript message', async () => {
  const progress: unknown[] = [];
  const studio: Studio = {
    start: async () => ({ conversationId: 'studio', replies: [] }),
    send: async (_id, _text, _request, output) => {
      await output({ type: 'partial', id: 'reply', text: 'Incomplete' });
      throw new Error('SSE interrupted');
    }
  };
  const relay = new Relay(new Repository(new MemoryBackend()), async () => studio, async () => {},
    async (_s, update) => { progress.push(update); });
  const s = (await relay.create('channel', 'msteams')).session;
  await assert.rejects(relay.customer(s.id, 'hello', 'request'), /SSE interrupted/);
  const saved = await relay.get(s.id);
  assert.equal(saved.messages.some(m => m.role === 'assistant'), false);
  assert.equal(saved.messages[0]?.delivery, 'uncertain');
  assert.deepEqual(progress.at(-1), { type: 'end', failed: true });
});

test('a typing-only Studio turn without escalation is not silently recorded as a successful answer', async () => {
  const studio: Studio = {
    start: async () => ({ conversationId: 'studio', replies: [] }),
    send: async (_id, _text, _request, output) => { await output({ type: 'typing' }); }
  };
  const relay = new Relay(new Repository(new MemoryBackend()), async () => studio);
  const s = (await relay.create('channel', 'msteams')).session;
  await assert.rejects(relay.customer(s.id, 'hello', 'request'), /without an answer/);
  assert.equal((await relay.get(s.id)).messages[0]?.delivery, 'uncertain');
});

test('escalation cannot overtake an in-flight final delivery in the same conversation', async () => {
  let release!: () => void, entered!: () => void;
  const sending = new Promise<void>(resolve => { entered = resolve; });
  const delivery = new Promise<void>(resolve => { release = resolve; });
  const delivered: string[] = [];
  const studio: Studio = {
    start: async () => ({ conversationId: 'studio', replies: [] }),
    send: async (_id, _text, _request, output) => {
      await output({ type: 'message', id: 'reply', text: 'Already sending' });
    }
  };
  const relay = new Relay(new Repository(new MemoryBackend()), async () => studio, async (_s, message) => {
    if (message.role === 'assistant') { entered(); await delivery; }
    delivered.push(message.role);
  });
  const s = (await relay.create('channel', 'msteams')).session;
  const turn = relay.customer(s.id, 'hello', 'request');
  await sending;
  const escalation = relay.escalate({ conversationId: s.studioId, reason: 'Human requested', summary: 'Test' });
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.equal((await relay.get(s.id)).mode, 'bot');
  release();
  await Promise.all([turn, escalation]);
  assert.deepEqual(delivered, ['assistant', 'system']);
  assert.equal((await relay.get(s.id)).mode, 'waiting');
});

test('a customer message during handback gets one retry notice rather than an SDK crash', async t => {
  const app = new AgentApplication({
    storage: new MemoryStorage(), authorization: { mcs: { azureBotOAuthConnectionName: 'mcs' } }
  });
  const context = channelContext(app);
  context.activity.id = 'followup';
  context.activity.text = 'Another question';
  const client = new UserTokenClient('sample-bot');
  context.turnState.set(app.adapter.UserTokenClientKey, client);
  t.mock.method(client, 'getTokenOrSignInResource', async () => ({ tokenResponse: { token: 'delegated-token' } }));
  t.mock.method(console, 'warn', () => {});
  const sent: string[] = [];
  t.mock.method(app.adapter, 'sendActivities', async (_context, activities) => {
    sent.push(...activities.filter(a => a.type === 'message').map(a => a.text!));
    return activities.map(() => ({ id: 'notice' }));
  });
  const channels = new Channels(app);
  const studio: Studio = {
    start: async () => ({ conversationId: 'studio', replies: [] }),
    send: async () => { throw new Error('A pending handback must not execute a new Studio turn'); }
  };
  const relay = new Relay(new Repository(new MemoryBackend()), async () => studio);
  channels.attach(relay);
  const { channelId, conversation, from } = context.activity;
  const key = hash(JSON.stringify([channelId, conversation?.tenantId, conversation?.id, from?.id]));
  const s = (await relay.create(key, 'msteams', context.activity.getConversationReference())).session;
  await relay.repo.change(state => {
    state.sessions[s.id]!.mode = 'resuming';
    state.sessions[s.id]!.turn = { kind: 'handback', id: 'returning' };
  });
  await app.run(context);
  assert.equal(sent.length, 1);
  assert.match(sent[0]!, /turn or handback is pending/);
});
