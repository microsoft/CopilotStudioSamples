const $ = id => document.getElementById(id);
const support = document.body.dataset.page === 'support';
let selected = null, sessions = [], busy = false;
let customer = JSON.parse(sessionStorage.getItem('handover-customer') || 'null');
const labels = { bot: 'With assistant', waiting: 'Waiting for support', human: 'With support', resuming: 'Returning to assistant', handback_failed: 'Handback needs attention' };
async function api(path, body) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (!support && customer) headers.Authorization = `Bearer ${customer.token}`;
  const response = await fetch(path, { method: body === undefined ? 'GET' : 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);
  return result;
}
function show(s) {
  if (!s) return;
  $('status').textContent = labels[s.mode] || s.mode;
  $('correlation').textContent = `Relay: ${s.id}\nStudio: ${s.studioId}`;
  const history = $('history');
  const nearBottom = history.scrollHeight - history.scrollTop - history.clientHeight < 60;
  history.replaceChildren();
  for (const message of s.messages) {
    const node = document.createElement('div'); node.className = `message ${message.role}`;
    const author = document.createElement('strong'); author.textContent = { customer: 'Customer', assistant: 'Assistant', human: 'Support', system: 'Conversation update' }[message.role];
    node.append(author, document.createTextNode(message.text));
    if (message.delivery === 'uncertain') { const hint = document.createElement('small'); hint.textContent = 'Delivery is uncertain. Check the recipient before resending.'; node.append(hint); }
    history.append(node);
  }
  if (nearBottom) history.scrollTop = history.scrollHeight;
  const canSend = support ? s.mode === 'human' : !['resuming', 'handback_failed'].includes(s.mode);
  $('message').disabled = busy || !canSend; $('send').disabled = busy || !canSend;
  if (support) {
    $('title').textContent = `Chat ${s.id.slice(0, 8)}`;
    $('summary').textContent = s.summary || '';
    $('claim').disabled = busy || s.mode !== 'waiting';
    $('close').disabled = busy || !['human', 'handback_failed'].includes(s.mode);
  }
  if (s.handback?.error) $('error').textContent = s.handback.error;
}
async function refresh() {
  if (support) {
    sessions = await api('/api/support');
    const inbox = $('inbox'); inbox.replaceChildren();
    for (const s of sessions.filter(s => s.mode !== 'bot' || s.handback)) {
      const button = document.createElement('button'); button.type = 'button';
      button.textContent = s.summary || `Chat ${s.id.slice(0, 8)}`;
      const status = document.createElement('small'); status.textContent = labels[s.mode]; button.append(status);
      button.setAttribute('aria-pressed', String(selected === s.id));
      button.addEventListener('click', () => { selected = s.id; $('error').textContent = ''; show(s); });
      inbox.append(button);
    }
    show(sessions.find(s => s.id === selected));
  } else if (customer) show(await api(`/api/customer/${customer.id}`));
}
async function act(action) {
  if (busy) return;
  busy = true; $('error').textContent = '';
  $('send').disabled = true;
  try { await action(); await refresh(); }
  catch (error) { $('error').textContent = error.message; }
  finally {
    busy = false;
    if (support) show(sessions.find(s => s.id === selected));
    else if (customer) {
      try { show(await api(`/api/customer/${customer.id}`)); } catch (error) { $('error').textContent = error.message; }
    }
  }
}
$('compose').addEventListener('submit', event => {
  event.preventDefault();
  const value = $('message').value;
  void act(async () => {
    const id = support ? selected : customer?.id;
    if (!id) throw new Error('Select or start a conversation first.');
    await api(`/api/${support ? 'support' : 'customer'}/${id}/messages`, { text: value, requestId: crypto.randomUUID() });
    $('message').value = '';
  });
});
if (support) {
  $('refresh').addEventListener('click', () => void act(refresh));
  $('claim').addEventListener('click', () => void act(() => api(`/api/support/${selected}/claim`, {})));
  $('close').addEventListener('click', () => void act(() => api(`/api/support/${selected}/close`, {})));
} else {
  $('start').addEventListener('click', () => void act(async () => {
    const result = await api('/api/customer', {});
    customer = { id: result.session.id, token: result.token };
    sessionStorage.setItem('handover-customer', JSON.stringify(customer));
    show(result.session);
    $('start').disabled = true;
  }));
}
try {
  const config = await api('/api/config');
  if (!support) $('environment').textContent = config.mode === 'mock' ? 'Local deterministic demo. No real Studio agent is being called.' : 'Real agent: use Teams/Microsoft 365 personal chat.';
  await refresh();
} catch (error) { $('error').textContent = error.message; }
setInterval(() => { if (!busy) void refresh().catch(error => { $('error').textContent = error.message; }); }, 2000);
