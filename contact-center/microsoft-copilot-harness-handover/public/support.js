import { DeskState, statusLabels } from './desk-state.js';

const $ = id => document.getElementById(id);
const model = new DeskState('');
const positions = new Map();
let renderedChat = null, renderedIds = [], polling = false;
const time = value => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const title = chat => `Chat ${chat.id.slice(0, 6)}`;
function element(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = value;
  return node;
}
async function api(url, body) {
  const response = await fetch(url, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(30000),
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('The relay is unavailable. Check the server, then retry.');
  }
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);
  return result;
}
function rememberPosition() {
  if (renderedChat) positions.set(renderedChat, $('history').scrollTop);
}
function select(id) {
  rememberPosition();
  model.select(id);
  render();
}
function renderQueue() {
  const focus = document.activeElement?.dataset.chat;
  const inbox = $('inbox');
  const scroll = inbox.scrollTop;
  inbox.replaceChildren();
  const chats = model.visible();
  const waiting = [...model.chats.values()].filter(chat => chat.mode === 'waiting').length;
  $('queue-count').textContent = String(waiting);
  $('next-chat').disabled = waiting === 0;
  $('mine-count').textContent = String([...model.chats.values()].filter(chat => chat.operator === model.operator && chat.mode !== 'bot').length);
  for (const chat of chats) {
    const button = element('button', `queue-chat state-${chat.mode}`);
    button.type = 'button'; button.dataset.chat = chat.id;
    button.setAttribute('aria-pressed', String(chat.id === model.selected));
    const line = element('span', 'queue-line');
    line.append(element('strong', '', title(chat)), element('span', 'chat-channel', chat.channel === 'msteams' ? 'Teams/M365' : 'Browser'));
    const last = [...chat.messages].reverse().find(message => message.role === 'customer');
    button.append(line, element('span', 'queue-subject', chat.summary || chat.reason || 'Support conversation'));
    if (last) button.append(element('span', 'queue-preview', last.text));
    const meta = element('span', 'queue-line queue-meta');
    meta.append(element('span', `status-text state-${chat.mode}`, statusLabels[chat.mode]));
    const unread = model.unread(chat.id);
    meta.append(element('span', unread ? 'unread-count' : 'queue-time', unread ? `${unread} new` : time(chat.messages.at(-1)?.at ?? Date.now())));
    button.append(meta);
    if (model.errors.has(chat.id)) button.append(element('span', 'queue-error', 'Action needs attention'));
    if (model.draft(chat.id)) button.append(element('span', 'draft-indicator', 'Draft saved in this tab'));
    button.addEventListener('click', () => select(chat.id));
    inbox.append(button);
  }
  if (!chats.length) inbox.append(element('p', 'queue-empty', model.search ? 'No conversations match your search.' : 'No chats in this view. Waiting conversations will appear here.'));
  for (const button of document.querySelectorAll('[data-filter]')) button.setAttribute('aria-pressed', String(button.dataset.filter === model.filter));
  if (focus) [...inbox.querySelectorAll('button')].find(button => button.dataset.chat === focus)?.focus({ preventScroll: true });
  inbox.scrollTop = scroll;
}
function renderTabs() {
  const tabs = $('chat-tabs');
  const scroll = tabs.scrollLeft;
  tabs.replaceChildren();
  for (const id of model.tabs) {
    const chat = model.chats.get(id), holder = element('div', `chat-tab${id === model.selected ? ' selected' : ''}`);
    const tab = element('button', '', title(chat));
    tab.type = 'button'; tab.id = `tab-${id}`; tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', String(id === model.selected));
    tab.setAttribute('aria-controls', 'chat-panel');
    tab.tabIndex = id === model.selected ? 0 : -1;
    const unread = model.unread(id);
    if (unread) tab.append(element('span', 'unread-count', String(unread)));
    if (model.pending.has(id)) tab.append(element('span', 'tab-progress', 'Working'));
    tab.addEventListener('click', () => select(id));
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const step = event.key === 'ArrowRight' ? 1 : -1;
      const next = event.key === 'Home' ? model.tabs[0] : event.key === 'End' ? model.tabs.at(-1)
        : model.tabs[(model.tabs.indexOf(id) + step + model.tabs.length) % model.tabs.length];
      select(next); document.getElementById(`tab-${next}`)?.focus();
    });
    const close = element('button', 'close-tab', '×'); close.type = 'button'; close.id = `close-tab-${id}`;
    close.setAttribute('aria-label', `Close tab for ${title(chat)}; keep conversation active`);
    close.addEventListener('click', () => {
      rememberPosition(); model.closeTab(id); render();
      (document.getElementById(`tab-${model.selected}`) ?? $('next-chat')).focus();
    });
    holder.append(tab, close); tabs.append(holder);
  }
  tabs.scrollLeft = scroll;
}
function renderMessages(chat) {
  const history = $('history'), switching = renderedChat !== chat.id;
  const ids = chat.messages.map(message => message.id);
  const append = !switching && renderedIds.every((id, index) => ids[index] === id);
  const bottom = history.scrollHeight - history.scrollTop - history.clientHeight < 70;
  if (!append) history.replaceChildren();
  for (const message of chat.messages.slice(append ? renderedIds.length : 0)) {
    const row = element('article', `desk-message role-${message.role}`);
    const heading = element('div', 'message-heading');
    heading.append(element('strong', '', { customer: 'Customer', human: 'You / support', assistant: 'Assistant', system: 'Conversation update' }[message.role]));
    const stamp = element('time', '', time(message.at)); stamp.dateTime = message.at;
    heading.append(stamp); row.append(heading, element('p', '', message.text));
    row.dataset.message = message.id; history.append(row);
  }
  for (let index = 0; index < chat.messages.length; index++) {
    const row = history.children[index], message = chat.messages[index];
    if (!row) continue;
    let delivery = row.querySelector('.delivery-warning');
    if (message.delivery === 'uncertain' && !delivery) {
      delivery = element('small', 'delivery-warning', 'Delivery uncertain. Check the recipient before resending.');
      row.append(delivery);
    } else if (message.delivery !== 'uncertain') delivery?.remove();
  }
  renderedChat = chat.id; renderedIds = ids;
  if (switching) history.scrollTop = positions.get(chat.id) ?? history.scrollHeight;
  else if (bottom) history.scrollTop = history.scrollHeight;
}
function renderConversation() {
  const chat = model.chats.get(model.selected);
  $('desk-empty').hidden = Boolean(chat); $('chat-panel').hidden = !chat;
  if (!chat) { renderedChat = null; renderedIds = []; return; }
  $('chat-panel').setAttribute('aria-labelledby', `tab-${chat.id}`);
  const action = model.pending.get(chat.id), mine = chat.operator === model.operator;
  $('title').textContent = title(chat);
  $('status').textContent = statusLabels[chat.mode]; $('status').className = `state-chip state-${chat.mode}`;
  $('subject').textContent = chat.summary || chat.reason || 'Customer support conversation';
  $('ownership').textContent = chat.mode === 'waiting' ? 'Unassigned' : mine ? 'Assigned to you' : chat.operator ? 'Assigned to another operator' : 'With assistant';
  $('relay-id').textContent = chat.id; $('studio-id').textContent = chat.studioId;
  $('reason').textContent = chat.reason || 'No escalation reason recorded';
  $('claim').disabled = Boolean(action) || chat.mode !== 'waiting';
  $('claim').hidden = chat.mode !== 'waiting';
  $('close').disabled = Boolean(action) || !mine || !['human', 'handback_failed'].includes(chat.mode);
  $('close').hidden = !mine || !['human', 'handback_failed', 'resuming'].includes(chat.mode);
  $('close').textContent = action === 'close' ? 'Returning conversation...' : chat.mode === 'handback_failed' ? 'Retry return to assistant' : 'Return to assistant';
  const switching = renderedChat !== chat.id;
  if (switching || $('message').value !== model.draft(chat.id)) $('message').value = model.draft(chat.id);
  $('message').disabled = Boolean(action) || !mine || chat.mode !== 'human';
  $('send').disabled = Boolean(action) || !mine || chat.mode !== 'human' || !model.draft(chat.id).trim();
  $('send').textContent = action === 'messages' ? 'Sending...' : 'Send reply';
  $('compose-hint').textContent = chat.mode === 'waiting' ? 'Claim this chat to start replying.'
    : chat.mode === 'human' && mine ? 'This draft belongs to this chat. Switching chats will keep it.'
    : chat.mode === 'human' ? 'Another operator owns this chat.'
    : chat.mode === 'resuming' ? 'Sharing the transcript with the same assistant conversation.'
    : chat.mode === 'handback_failed' ? 'Return failed. Review the error before retrying.'
    : 'The assistant is handling this conversation.';
  $('chat-error').textContent = model.errors.get(chat.id) || chat.handback?.error || '';
  renderMessages(chat);
}
function render() {
  const focus = document.activeElement?.id;
  renderQueue(); renderTabs(); renderConversation();
  if (focus?.startsWith('tab-') || focus?.startsWith('close-tab-')) document.getElementById(focus)?.focus({ preventScroll: true });
}
async function refresh() {
  const snapshot = model.startRefresh();
  try {
    const [identity, chats] = await Promise.all([api('/api/support/me'), api('/api/support')]);
    if (!model.ingest(chats, snapshot)) return;
    model.operator = identity.id;
    if (model.selected && !document.hidden) model.markSeen(model.selected);
    $('connection').textContent = 'Connected'; $('connection').dataset.connected = 'true';
    $('global-error').textContent = '';
    render();
  } catch (error) {
    if (snapshot.sequence !== model.refreshSequence) return;
    $('connection').textContent = 'Connection interrupted'; $('connection').dataset.connected = 'false';
    $('global-error').textContent = `${error.message} Your drafts are still here.`;
  }
}
async function mutate(id, action, body) {
  if (!id || !model.begin(id, action)) return;
  render();
  try {
    const chat = await api(`/api/support/${id}/${action}`, body);
    if (action === 'messages') model.sent(id, body);
    model.finish(id, chat);
    if (id === model.selected && !document.hidden) model.markSeen(id);
  } catch (error) {
    model.finish(id, null, action === 'messages'
      ? `${error.message} Delivery is not confirmed. Check the transcript before retrying; retrying the unchanged draft uses the same message ID.`
      : error.message);
  } finally { render(); }
}
$('message').addEventListener('input', () => {
  if (!model.selected) return;
  model.setDraft(model.selected, $('message').value);
  const chat = model.chats.get(model.selected);
  $('send').disabled = model.pending.has(model.selected) || chat?.mode !== 'human'
    || chat.operator !== model.operator || !model.draft(model.selected).trim();
});
$('compose').addEventListener('submit', event => {
  event.preventDefault();
  const id = model.selected;
  if (id && model.draft(id).trim()) void mutate(id, 'messages', model.request(id));
});
$('claim').addEventListener('click', () => void mutate(model.selected, 'claim', {}));
$('close').addEventListener('click', () => void mutate(model.selected, 'close', {}));
$('refresh').addEventListener('click', () => void refresh());
$('search').addEventListener('input', () => { model.search = $('search').value; renderQueue(); });
for (const button of document.querySelectorAll('[data-filter]')) button.addEventListener('click', () => { model.filter = button.dataset.filter; renderQueue(); });
$('next-chat').addEventListener('click', () => {
  const next = [...model.chats.values()].find(chat => chat.mode === 'waiting');
  if (next) select(next.id);
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && model.selected) { model.markSeen(model.selected); renderQueue(); renderTabs(); }
});
await refresh();
setInterval(async () => {
  if (polling) return;
  polling = true;
  try { await refresh(); } finally { polling = false; }
}, 2000);
