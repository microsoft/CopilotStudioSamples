import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { Relay, SignInRequired, type Delivery, type Studio } from '../src/relay.js';
import { FileBackend, MemoryBackend, Repository, type Session } from '../src/store.js';
import { AgentApplication, HttpError as SdkHttpError, MemoryStorage, TurnContext, UserTokenClient } from '@microsoft/agents-hosting';
import { Activity, ExceptionHelper } from '@microsoft/agents-activity';
import { Channels, errorCauses } from '../src/channels.js';
import { teamsConsentFallback } from '../src/teams-consent.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { MockStudio, SdkStudio } from '../src/studio.js';
import { createWebApp } from '../src/web.js';

function fixture(deliver?: Delivery) {
  const backend = new MemoryBackend();
  const repo = new Repository(backend);
  let relay: Relay;
  const sent: { id: string; text: string }[] = [];
  let fail: 'auth' | 'send' | undefined;
  const studio = new MockStudio(parameters => relay.escalate(parameters));
  const wrapped: Studio = {
    start: () => studio.start(),
    send: async (id, value, activityId, output) => {
      sent.push({ id, text: value });
      if (fail === 'send') throw new Error('Uncertain remote delivery');
      return studio.send(id, value, activityId, output);
    }
  };
  relay = new Relay(repo, async () => {
    if (fail === 'auth') throw new SignInRequired();
    return wrapped;
  }, deliver);
  return { relay, repo, backend, sent, fail: (value: typeof fail) => { fail = value; } };
}
test('real channel uses the consent-capable Bot OAuth token without a second OBO exchange', async t => {
  const app = new AgentApplication({
    storage: new MemoryStorage(),
    authorization: { mcs: { azureBotOAuthConnectionName: 'mcs' } }
  });
  const context = new TurnContext(app.adapter, Activity.fromObject({
    type: 'message', channelId: 'msteams',
    conversation: { id: 'customer-channel', conversationType: 'personal' },
    from: { id: 'customer' }, recipient: { id: 'relay' },
    serviceUrl: 'https://smba.trafficmanager.net/teams/'
  }));
  const session: Session = {
    id: 'relay-session', studioId: 'studio-session', channel: 'msteams', channelKey: 'customer-key',
    reference: context.activity.getConversationReference(),
    mode: 'bot', cycle: 0, messages: [], segmentStart: 0
  };
  t.mock.method(app.adapter, 'continueConversation', async (_id, _reference, logic) => {
    await logic(context);
  });
  let token: string | undefined = 'delegated-power-platform-token';
  const get = t.mock.method(app.authorization, 'getToken', async (turn, handler) => {
    assert.equal(turn, context);
    assert.equal(handler, 'mcs');
    return { token };
  });
  const exchange = t.mock.method(app.authorization, 'exchangeToken', async () => {
    throw new Error('Second OBO exchange cannot request interactive consent');
  });
  const channels = new Channels(app);
  assert.ok(await channels.studio(session) instanceof SdkStudio);
  token = undefined;
  await assert.rejects(channels.studio(session), SignInRequired);
  assert.equal(get.mock.callCount(), 2);
  assert.equal(exchange.mock.callCount(), 0);
});
test('channel diagnostics retain nested authentication causes without logging bearer tokens', () => {
  const root = new Error('Consent denied; Bearer opaque-token; assertion eyJhbGciOiJSUzI1NiJ9.eyJhdWQiOiJhcHAifQ.signature');
  const wrapped = ExceptionHelper.generateException(Error, { code: -120510, description: 'Failed to sign in' }, root);
  const details = errorCauses(wrapped);
  assert.match(details[0]!.message, /Failed to sign in/);
  assert.match(details[1]!.message, /Consent denied/);
  assert.doesNotMatch(JSON.stringify(details), /opaque-token|eyJhbGci/);
  const cyclic = new Error('Cycle');
  cyclic.cause = cyclic;
  assert.equal(errorCauses(cyclic).length, 5);
});
test('signout works before authorization and clears only this connection without false success', async t => {
  const app = new AgentApplication({
    storage: new MemoryStorage(),
    authorization: { mcs: { azureBotOAuthConnectionName: 'mcs' } }
  });
  const context = new TurnContext(app.adapter, Activity.fromObject({
    type: 'message', text: '--signout', channelId: 'msteams',
    from: { id: 'customer' }, recipient: { id: 'relay' },
    conversation: { id: 'customer-channel', conversationType: 'personal' }
  }));
  const notices: string[] = [];
  t.mock.method(app.adapter, 'sendActivities', async (_turn, activities) => {
    for (const activity of activities) if (activity.type === 'message' && activity.text) notices.push(activity.text);
    return activities.map(() => ({ id: 'signout-notice' }));
  });
  t.mock.method(app.authorization, 'getToken', async () => {
    throw new Error('Signout must not require a valid login');
  });
  const signout = t.mock.method(app.authorization, 'signOut', async (turn, _state, handler) => {
    assert.equal(turn.activity.from?.id, 'customer');
    assert.equal(turn.activity.conversation?.id, 'customer-channel');
    assert.equal(handler, 'mcs');
  });
  new Channels(app);
  await app.run(context);
  assert.equal(signout.mock.callCount(), 1);
  assert.equal(notices.length, 1);
  assert.match(notices[0]!, /Signed out/);
  signout.mock.mockImplementation(async () => { throw new Error('Token service unavailable'); });
  await assert.rejects(app.run(context), /Token service unavailable/);
  assert.equal(notices.length, 1, 'a failed signout must not report success');
});
test('Teams sign-in failures retain sanitized service diagnostics and the existing failure response', async t => {
  const app = new AgentApplication({
    storage: new MemoryStorage(),
    authorization: { mcs: { azureBotOAuthConnectionName: 'mcs', enableSso: true } }
  });
  const client = new UserTokenClient('sample-bot');
  const outgoing: Activity[] = [];
  const log = t.mock.method(console, 'error', () => {});
  t.mock.method(app.adapter, 'sendActivities', async (_context, activities) => {
    outgoing.push(...activities);
    return activities.map(() => ({ id: 'response' }));
  });
  t.mock.method(client, 'getTokenOrSignInResource', async () => ({
    signInResource: { signInLink: 'https://token.botframework.com/signin/test' }
  }));
  new Channels(app);
  for (const activity of [
    { type: 'message', text: 'hi' },
    { type: 'invoke', name: 'signin/failure', value: {
      message: 'Resource mismatch; Bearer private-token; eyJhbGciOiJSUzI1NiJ9.eyJhdWQiOiJhcHAifQ.signature',
      token: 'unrelated-secret-field'
    } }
  ]) {
    const context = new TurnContext(app.adapter, Activity.fromObject({
      channelId: 'msteams', from: { id: 'customer' }, recipient: { id: 'relay' },
      conversation: { id: 'customer-channel', conversationType: 'personal' }, ...activity
    }));
    context.turnState.set(app.adapter.UserTokenClientKey, client);
    await app.run(context);
  }
  assert.equal(outgoing.at(-2)!.value.status, 200);
  assert.equal(outgoing.at(-1)!.text, 'Failed to sign-in. Please try again.');
  assert.equal(log.mock.callCount(), 1);
  const diagnostic = String(log.mock.calls[0]!.arguments[0]);
  assert.match(diagnostic, /channel_signin_failed/);
  assert.match(diagnostic, /Resource mismatch/);
  assert.doesNotMatch(diagnostic, /private-token|eyJhbGci|unrelated-secret-field/);
});
test('Teams consent-required exchange returns 412 and preserves the pending customer turn until consent', async t => {
  const app = new AgentApplication({
    storage: new MemoryStorage(),
    authorization: { mcs: { azureBotOAuthConnectionName: 'mcs', enableSso: true } }
  });
  const client = new UserTokenClient('sample-bot');
  const outgoing: Activity[] = [];
  const handled: string[] = [];
  t.mock.method(console, 'warn', () => {});
  t.mock.method(app.adapter, 'sendActivities', async (_context, activities) => {
    outgoing.push(...activities);
    return activities.map(() => ({ id: 'response' }));
  });
  app.onActivity('message', async context => { handled.push(context.activity.text!); }, ['mcs']);
  const lookup = t.mock.method(client, 'getTokenOrSignInResource', async () => ({
    signInResource: {
      signInLink: 'https://token.botframework.com/signin/test',
      tokenExchangeResource: { id: 'exchange-id', uri: 'api://sample' }
    }
  }));
  const request = { method: 'post', url: '/api/usertoken/exchange' };
  const failure = new SdkHttpError('Consent Required', {
    status: 400, statusText: 'Bad Request', headers: new Headers(), config: request,
    data: { error: { code: 'ServiceError', message: 'Consent Required' } }
  }, request);
  const exchange = t.mock.method(client, 'exchangeTokenAsync', async () => { throw failure; });
  const turn = async (activity: Partial<Activity>) => {
    const context = new TurnContext(app.adapter, Activity.fromObject({
      channelId: 'msteams', from: { id: 'customer' }, recipient: { id: 'relay' },
      conversation: { id: 'customer-channel', conversationType: 'personal' },
      ...activity
    }));
    context.turnState.set(app.adapter.UserTokenClientKey, client);
    await teamsConsentFallback(context, () => app.run(context));
  };
  await turn({ type: 'message', text: 'hi' });
  assert.equal(handled.length, 0);
  assert.equal(outgoing[0]!.attachments?.[0]?.contentType, 'application/vnd.microsoft.card.oauth');
  await turn({
    type: 'invoke', name: 'signin/tokenExchange',
    value: { id: 'exchange-id', connectionName: 'mcs', token: 'teams-token' }
  });
  assert.equal(outgoing.at(-1)!.type, 'invokeResponse');
  assert.equal(outgoing.at(-1)!.value.status, 412);
  assert.equal(outgoing.at(-1)!.value.body.id, 'exchange-id');
  assert.equal(handled.length, 0, 'consent failure must not authorize the customer');
  assert.equal(client.exchangeTokenAsync, exchange, 'the request-scoped override is restored');
  lookup.mock.mockImplementation(async () => ({ tokenResponse: { token: 'consented-platform-token' } }));
  await turn({ type: 'invoke', name: 'signin/verifyState', value: { state: '123456' } });
  assert.deepEqual(handled, ['hi'], 'interactive consent resumes the original customer turn exactly once');
  assert.equal(outgoing.at(-1)!.value.status, 200);
  assert.equal(exchange.mock.callCount(), 1);
});
test('Teams consent fallback preserves successful tokens and does not mask unrelated failures', async t => {
  const app = new AgentApplication({ storage: new MemoryStorage() });
  const context = new TurnContext(app.adapter, Activity.fromObject({
    type: 'invoke', channelId: 'msteams', name: 'signin/tokenExchange'
  }));
  const client = new UserTokenClient('sample-bot');
  context.turnState.set(app.adapter.UserTokenClientKey, client);
  const request = { method: 'post', url: '/api/usertoken/exchange' };
  let failure: Error | undefined;
  const exchange = t.mock.method(client, 'exchangeTokenAsync', async () => {
    if (failure) throw failure;
    return { token: 'valid-platform-token' };
  });
  await teamsConsentFallback(context, async () => {
    assert.deepEqual(await client.exchangeTokenAsync('customer', 'mcs', 'msteams', { token: 'teams-token' }),
      { token: 'valid-platform-token' });
  });
  for (const [status, message, connection] of [
    [500, 'Consent Required', 'mcs'],
    [400, 'Invalid client secret', 'mcs'],
    [400, 'Consent Required', 'another-connection']
  ] as const) {
    failure = new SdkHttpError(message, {
      status, statusText: 'Failure', headers: new Headers(), config: request,
      data: { error: { message } }
    }, request);
    await assert.rejects(teamsConsentFallback(context, async () => {
      await client.exchangeTokenAsync('customer', connection, 'msteams', { token: 'teams-token' });
    }), error => error === failure);
    assert.equal(client.exchangeTokenAsync, exchange);
  }
  context.activity.type = 'message';
  await assert.rejects(teamsConsentFallback(context, async () => {
    await client.exchangeTokenAsync('customer', 'mcs', 'msteams', { token: 'teams-token' });
  }), error => error === failure);
});
test('local disk backend preserves correlation across restart and rejects a stale write', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'handover-state-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'state.json');
  const first = new FileBackend(file);
  const snapshot = await first.read();
  snapshot.state.studioIndex['studio-authoritative'] = 'relay-distinct';
  assert.equal(await first.write(snapshot.state, snapshot.version), true);
  const restarted = new FileBackend(file);
  assert.equal((await restarted.read()).state.studioIndex['studio-authoritative'], 'relay-distinct');
  assert.equal(await first.write({ sessions: {}, studioIndex: {} }, snapshot.version), false);
  assert.equal((await restarted.read()).state.studioIndex['studio-authoritative'], 'relay-distinct');
});
async function humanChat(f = fixture()) {
  const { session } = await f.relay.create('channel-one', 'browser');
  await f.relay.customer(session.id, 'Talk to a human', 'request-1');
  await f.relay.claim(session.id, 'operator');
  return { ...f, id: session.id, studioId: session.studioId };
}
test('handback keeps customer routing locked until the immediate acknowledgement is delivered', async () => {
  let release!: () => void, entered!: () => void;
  const delivering = new Promise<void>(resolve => { entered = resolve; });
  const resume = new Promise<void>(resolve => { release = resolve; });
  const f = fixture(async (_session, message) => {
    if (message.role === 'assistant') { entered(); await resume; }
  });
  const { session } = await f.relay.create('teams-ordering', 'msteams');
  await f.relay.customer(session.id, 'Talk to a human', 'start');
  await f.relay.claim(session.id, 'operator');
  await f.relay.human(session.id, 'operator', 'Replacement code ZX-294.', 'human-reply');
  const closing = f.relay.close(session.id, 'operator');
  await delivering;
  assert.equal((await f.relay.get(session.id)).mode, 'resuming');
  await assert.rejects(f.relay.customer(session.id, 'Do not overtake the acknowledgement', 'next'), /pending/);
  release();
  assert.equal((await closing).mode, 'bot');
});
test('a pending or uncertain human reply blocks handback and further support replies in that chat only', async () => {
  let release!: () => void, entered!: () => void;
  const delivering = new Promise<void>(resolve => { entered = resolve; });
  const resume = new Promise<void>(resolve => { release = resolve; });
  const f = fixture(async (_session, message) => {
    if (message.role === 'human') { entered(); await resume; throw new Error('Uncertain channel delivery'); }
  });
  const { session } = await f.relay.create('teams-delivery', 'msteams');
  await f.relay.customer(session.id, 'Talk to a human', 'start');
  await f.relay.claim(session.id, 'operator');
  const sending = assert.rejects(f.relay.human(session.id, 'operator', 'Pending reply', 'human-reply'), /Uncertain channel delivery/);
  await delivering;
  await assert.rejects(f.relay.close(session.id, 'operator'), /support reply is pending or uncertain/);
  await assert.rejects(f.relay.human(session.id, 'operator', 'Must not overtake', 'another-reply'), /prior support reply is pending or uncertain/);
  const other = await humanChat(f);
  assert.equal((await f.relay.close(other.id, 'operator')).mode, 'bot', 'another chat is not locked');
  release();
  await sending;
  assert.equal((await f.relay.get(session.id)).messages.at(-1)!.delivery, 'uncertain');
  await assert.rejects(f.relay.close(session.id, 'operator'), /support reply is pending or uncertain/);
});
test('handover and immediate handback retain Studio ID, include human-only detail, and suppress late bot output', async () => {
  const f = await humanChat();
  assert.notEqual(f.id, f.studioId);
  await f.relay.customer(f.id, 'The replacement code is ZX-294', 'request-2');
  await f.relay.human(f.id, 'operator', 'Use replacement code ZX-294 tomorrow.', 'reply-1');
  const result = await f.relay.close(f.id, 'operator');
  assert.equal(result.mode, 'bot');
  assert.equal(result.studioId, f.studioId);
  assert.equal(f.sent.length, 2, 'human-mode customer message must not invoke Studio');
  assert.match(f.sent[1]!.text, /ZX-294/);
  assert.equal(f.sent[1]!.id, f.studioId);
  assert.doesNotMatch(result.messages.map(m => m.text).join('\n'), /late bot response/);
  assert.match(result.messages.at(-1)!.text, /ZX-294/);
  await f.relay.close(f.id, 'operator');
  assert.equal(f.sent.length, 2, 'duplicate close must not replay transcript');
  await f.relay.customer(f.id, 'human again please', 'request-3');
  const again = await f.relay.get(f.id);
  assert.equal(again.mode, 'waiting');
  assert.equal(again.studioId, f.studioId);
  await f.relay.claim(f.id, 'different-operator');
});
test('mock maker hook replaces the model-supplied ID without losing reason or summary', async () => {
  let captured: unknown;
  const studio = new MockStudio(async parameters => { captured = parameters; });
  await studio.send('authoritative-studio-id', 'I need a human', 'request', async () => {});
  assert.deepEqual(captured, {
    conversationId: 'authoritative-studio-id', reason: 'Customer requested human support', summary: 'I need a human'
  });
});
test('missing, unknown and relay/channel IDs cannot route; an idle bot cannot escalate', async () => {
  const f = fixture();
  const body = { reason: 'r', summary: 's' };
  await assert.rejects(f.relay.escalate(body), /conversationId/);
  await assert.rejects(f.relay.escalate({ ...body, conversationId: 'unknown' }), /not found/);
  const { session: s } = await f.relay.create('channel', 'browser');
  await assert.rejects(f.relay.escalate({ ...body, conversationId: s.id }), /not found/);
  await assert.rejects(f.relay.escalate({ ...body, conversationId: 'channel' }), /not found/);
  await assert.rejects(f.relay.escalate({ ...body, conversationId: s.studioId }), /eligible customer turn/);
  assert.equal((await f.relay.get(s.id)).mode, 'bot');
});
test('duplicate callbacks preserve ownership and transcript; callbacks cannot re-escalate an idle returned bot', async () => {
  const f = await humanChat();
  const old = await f.relay.get(f.id);
  const body = { conversationId: old.studioId, reason: old.reason, summary: old.summary };
  await f.relay.escalate(body);
  const repeated = await f.relay.get(f.id);
  assert.equal(repeated.mode, 'human');
  assert.equal(repeated.operator, 'operator');
  assert.equal(repeated.messages.length, old.messages.length);
  await assert.rejects(f.relay.escalate({ ...body, summary: 'different' }), /different handover/);
  await f.relay.close(f.id, 'operator');
  await assert.rejects(f.relay.escalate(body), /eligible customer turn/);
});
test('two customers and concurrent claims cannot cross-route', async () => {
  const f = fixture();
  const [{ session: a }, { session: b }] = await Promise.all([
    f.relay.create('first-channel', 'browser'), f.relay.create('second-channel', 'browser')
  ]);
  await Promise.all([f.relay.customer(a.id, 'human', 'a-request'), f.relay.customer(b.id, 'hello', 'b-request')]);
  assert.equal((await f.relay.get(a.id)).mode, 'waiting');
  assert.equal((await f.relay.get(b.id)).mode, 'bot');
  const claims = await Promise.allSettled([f.relay.claim(a.id, 'one'), f.relay.claim(a.id, 'two')]);
  assert.equal(claims.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal((await f.relay.get(b.id)).messages.some(m => m.text === 'human'), false);
});
test('handback requires original-user authorization and safely retries before dispatch', async () => {
  const f = await humanChat();
  f.fail('auth');
  await assert.rejects(f.relay.close(f.id, 'operator'), /sign-in/);
  assert.equal((await f.relay.get(f.id)).handback!.stage, 'auth_required');
  f.fail(undefined);
  assert.equal((await f.relay.close(f.id, 'operator')).studioId, f.studioId);
});
test('uncertain handback is not silently replayed or replaced with a fresh conversation', async () => {
  const f = await humanChat();
  f.fail('send');
  await assert.rejects(f.relay.close(f.id, 'operator'), /Uncertain/);
  const after = await f.relay.get(f.id);
  assert.equal(after.handback!.stage, 'uncertain');
  assert.equal(after.studioId, f.studioId);
  f.fail(undefined);
  await assert.rejects(f.relay.close(f.id, 'operator'), /uncertain/);
  assert.equal(f.sent.length, 2);
});
test('duplicate customer IDs are safe but failed deliveries do not become success-shaped retries', async () => {
  const f = fixture();
  const { session: s } = await f.relay.create('channel', 'browser');
  await f.relay.customer(s.id, 'hello', 'one');
  await f.relay.customer(s.id, 'hello', 'one');
  assert.equal(f.sent.length, 1);
  await assert.rejects(f.relay.customer(s.id, 'different', 'one'), /different message/);
  f.fail('send');
  await assert.rejects(f.relay.customer(s.id, 'question', 'two'));
  await assert.rejects(f.relay.customer(s.id, 'question', 'two'), /uncertain/);
});
test('state survives a new repository instance and oversized transcript is explicitly refused', async () => {
  const f = await humanChat();
  const restarted = new Repository(f.backend);
  assert.equal((await restarted.read()).sessions[f.id]!.studioId, f.studioId);
  for (let i = 0; i < 16; i++) await f.relay.human(f.id, 'operator', 'x'.repeat(4000), `large-${i}`);
  await assert.rejects(f.relay.close(f.id, 'operator'), /limit/);
  assert.equal((await f.relay.get(f.id)).mode, 'human');
  assert.equal(f.sent.length, 1);
});
test('missing authoritative start metadata is rejected rather than borrowing a channel ID', async () => {
  const relay = new Relay(new Repository(new MemoryBackend()), async () => ({
    start: async () => ({ conversationId: '', replies: [] }), send: async () => {}
  }));
  await assert.rejects(relay.create('channel-id', 'browser'), /authoritative/);
});
for (const hosting of ['local', 'azure'] as const) test(`HTTP ${hosting}: customer isolation and unauthenticated mock support handover`, async t => {
  const { app, relay } = createWebApp({ mode: 'mock', hosting });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const address = server.address();
  assert(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  const request = async (path: string, body?: unknown, headers: Record<string, string> = {}) => fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { origin: hosting === 'azure' ? base.replace('http:', 'https:') : base, 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const created = await (await request('/api/customer', {})).json();
  const id = created.session.id;
  assert.equal((await request(`/api/customer/${id}`)).status, 403);
  assert.equal((await request('/api/support')).status, 200);
  assert.deepEqual(await (await request('/api/support/me', undefined, { 'x-ms-client-principal-id': 'spoofed' })).json(), { id: 'local-support' });
  assert.equal((await request('/api/hooks/pretool', {})).status, 404);
  assert.equal((await request('/api/escalate', { reason: 'Help', summary: 'Context' })).status, 400);
  assert.equal((await request('/api/escalate', { conversationId: id, reason: 'Help', summary: 'Context' })).status, 404);
  const connectorSession = (await relay.create('connector-no-auth-test', 'browser')).session;
  await relay.repo.change(state => { state.sessions[connectorSession.id]!.turn = { kind: 'customer', id: 'eligible-turn' }; });
  const response = await request('/api/escalate', {
    conversationId: connectorSession.studioId, reason: 'Customer request', summary: 'Connector test'
  });
  assert.equal(response.status, 200, 'the simple webhook needs only conversationId, reason and summary, with no token or header auth');
  assert.equal((await response.json()).handoverId, `${connectorSession.id}:1`);
  const auth = { authorization: `Bearer ${created.token}` };
  await request(`/api/customer/${id}/messages`, { text: 'human', requestId: 'first' }, auth);
  assert.equal((await request(`/api/support/${id}/claim`, {}, { origin: 'https://unrelated.test' })).status, 403);
  await request(`/api/support/${id}/claim`, {});
  await request(`/api/support/${id}/messages`, { text: 'Case 817 fixed', requestId: 'human-1' });
  const closed = await (await request(`/api/support/${id}/close`, {})).json();
  assert.equal(closed.mode, 'bot');
  assert.equal(closed.studioId, created.session.studioId);
  assert.match(closed.messages.at(-1).text, /Case 817 fixed/);
});
test('one operator can handle concurrent conversations without crossing replies or handback transcripts', async () => {
  const f = fixture();
  const [a, b] = await Promise.all([f.relay.create('customer-A', 'browser'), f.relay.create('customer-B', 'browser')]);
  await Promise.all([a, b].map(({ session }) => f.relay.customer(session.id, 'Talk to a human', 'same-channel-request-id')));
  await Promise.all([a, b].map(({ session }) => f.relay.claim(session.id, 'same-operator')));
  await Promise.all([
    f.relay.human(a.session.id, 'same-operator', 'Customer A secret detail ALPHA-81.', 'same-human-request-id'),
    f.relay.human(b.session.id, 'same-operator', 'Customer B secret detail BETA-92.', 'same-human-request-id')
  ]);
  const [returnedA, returnedB] = await Promise.all([
    f.relay.close(a.session.id, 'same-operator'), f.relay.close(b.session.id, 'same-operator')
  ]);
  assert.equal(returnedA.mode, 'bot'); assert.equal(returnedB.mode, 'bot');
  assert.equal(returnedA.studioId, a.session.studioId);
  assert.equal(returnedB.studioId, b.session.studioId);
  assert.notEqual(returnedA.studioId, returnedB.studioId);
  assert.match(returnedA.messages.at(-1)!.text, /ALPHA-81/);
  assert.match(returnedB.messages.at(-1)!.text, /BETA-92/);
  assert.doesNotMatch(JSON.stringify(returnedA.messages), /BETA-92/);
  assert.doesNotMatch(JSON.stringify(returnedB.messages), /ALPHA-81/);
});
