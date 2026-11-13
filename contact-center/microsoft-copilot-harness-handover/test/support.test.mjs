import test from 'node:test';
import assert from 'node:assert/strict';
import { DeskState } from '../public/desk-state.js';

const message = (id, role = 'customer') => ({ id, role, text: id, at: '2026-11-12T10:00:00Z' });
const chat = (id, extra = {}) => ({ id, mode: 'human', operator: 'operator', messages: [message(`${id}-1`)], ...extra });
function desk() {
  const state = new DeskState('operator');
  state.ingest([chat('a'), chat('b')]);
  return state;
}

test('switching and closing tabs preserve independent drafts and unread counts', () => {
  const state = desk();
  state.select('a');
  state.setDraft('a', 'Reply for A');
  state.select('b');
  state.setDraft('b', 'Reply for B');
  state.ingest([chat('a', { messages: [message('a-1'), message('a-2'), message('reply', 'human')] }), chat('b')]);
  assert.equal(state.unread('a'), 1);
  assert.equal(state.unread('b'), 0);
  state.closeTab('a');
  assert.equal(state.selected, 'b');
  assert.equal(state.draft('a'), 'Reply for A');
  assert.equal(state.draft('b'), 'Reply for B');
  state.select('a');
  assert.deepEqual(state.tabs, ['b', 'a']);
  assert.equal(state.unread('a'), 0);
});

test('a send completion is bound to the initiating chat, not the current selection', () => {
  const state = desk();
  state.select('a');
  state.setDraft('a', 'Reply for A');
  const request = state.request('a');
  assert.equal(state.begin('a', 'messages'), true);
  state.select('b');
  state.setDraft('b', 'Reply for B');
  assert.equal(state.begin('b', 'claim'), true);
  state.sent('a', request);
  state.finish('a', chat('a', { messages: [message(request.requestId, 'human')] }));
  assert.equal(state.selected, 'b');
  assert.equal(state.draft('a'), '');
  assert.equal(state.draft('b'), 'Reply for B');
  assert.equal(state.pending.get('b'), 'claim');
  assert.equal(state.chats.get('b').messages[0].id, 'b-1');
});

test('pending actions lock only their own chat and errors stay isolated', () => {
  const state = desk();
  assert.equal(state.begin('a', 'messages'), true);
  assert.equal(state.begin('a', 'close'), false);
  assert.equal(state.begin('b', 'close'), true);
  state.finish('a', null, 'Delivery uncertain');
  assert.equal(state.pending.has('a'), false);
  assert.equal(state.pending.get('b'), 'close');
  assert.equal(state.errors.get('a'), 'Delivery uncertain');
  assert.equal(state.errors.has('b'), false);
  state.begin('a', 'messages');
  assert.equal(state.errors.has('a'), false);
});

test('retrying unchanged drafts preserves request IDs; changed drafts get a new ID', () => {
  const state = desk();
  state.setDraft('a', 'A');
  state.setDraft('b', 'B');
  const request = state.request('a');
  state.begin('a', 'messages');
  state.finish('a', null, 'Timeout');
  state.select('b');
  assert.equal(state.request('a'), request);
  assert.notEqual(state.request('b').requestId, request.requestId);
  state.setDraft('a', 'A');
  assert.equal(state.request('a'), request);
  state.setDraft('a', 'Changed A');
  assert.notEqual(state.request('a').requestId, request.requestId);
});

test('send completion never clears edits made after the request started', () => {
  const state = desk();
  state.setDraft('a', 'Original');
  const original = state.request('a');
  state.setDraft('a', 'Next reply');
  const next = state.request('a');
  state.sent('a', original);
  assert.equal(state.draft('a'), 'Next reply');
  assert.equal(state.request('a'), next);
});

test('an older overlapping refresh cannot replace a newer snapshot', () => {
  const state = desk();
  const old = state.startRefresh();
  const recent = state.startRefresh();
  assert.equal(state.ingest([chat('a', { summary: 'Latest' }), chat('b')], recent), true);
  assert.equal(state.ingest([chat('a', { summary: 'Old' })], old), false);
  assert.equal(state.chats.get('a').summary, 'Latest');
  assert.equal(state.chats.has('b'), true);
});

for (const action of ['claim', 'messages', 'close']) {
  test(`refresh started before ${action} cannot roll back its result or unrelated updates`, () => {
    const state = desk();
    const before = state.startRefresh();
    state.begin('a', action);
    state.finish('a', chat('a', { summary: `${action} completed` }));
    state.ingest([chat('a'), chat('b', { summary: 'Fresh B' })], before);
    assert.equal(state.chats.get('a').summary, `${action} completed`);
    assert.equal(state.chats.get('b').summary, 'Fresh B');
  });
}

test('refresh started during mutation cannot remove its session or roll back its response', () => {
  const state = desk();
  state.begin('a', 'close');
  const during = state.startRefresh();
  state.finish('a', chat('a', { mode: 'bot', handback: { stage: 'complete' } }));
  state.ingest([chat('b')], during);
  assert.equal(state.chats.get('a').mode, 'bot');
  const after = state.startRefresh();
  state.ingest([chat('a', { mode: 'waiting' }), chat('b')], after);
  assert.equal(state.chats.get('a').mode, 'waiting');
});

test('pending mutations and failed mutations are protected from stale polls', () => {
  const state = desk();
  state.begin('a', 'messages');
  const during = state.startRefresh();
  state.ingest([chat('a', { summary: 'Stale' }), chat('b')], during);
  assert.equal(state.chats.get('a').summary, undefined);
  state.finish('a', null, 'Delivery uncertain');
  state.ingest([chat('a', { summary: 'Still stale' }), chat('b')], during);
  assert.equal(state.chats.get('a').summary, undefined);
  assert.equal(state.errors.get('a'), 'Delivery uncertain');
});

test('filters and search respect ownership, return state, and waiting priority', () => {
  const state = desk();
  state.ingest([chat('a'), chat('waiting', { mode: 'waiting', operator: undefined, summary: 'Billing' }),
    chat('returned', { mode: 'bot', handback: { stage: 'complete' } }),
    chat('other', { operator: 'someone-else' })]);
  assert.equal(state.visible()[0].id, 'waiting');
  assert.equal(state.visible().some(item => item.id === 'returned'), false);
  state.filter = 'mine';
  assert.deepEqual(state.visible().map(item => item.id), ['a']);
  state.filter = 'returned';
  assert.deepEqual(state.visible().map(item => item.id), ['returned']);
  state.filter = 'waiting';
  state.search = 'BILL';
  assert.deepEqual(state.visible().map(item => item.id), ['waiting']);
  state.search = 'not found';
  assert.deepEqual(state.visible(), []);
});

test('removing a session closes only its tab without discarding other chat state', () => {
  const state = desk();
  state.select('a');
  state.select('b');
  state.setDraft('a', 'Keep A');
  state.ingest([chat('a')], state.startRefresh());
  assert.deepEqual(state.tabs, ['a']);
  assert.equal(state.selected, 'a');
  assert.equal(state.draft('a'), 'Keep A');
});
