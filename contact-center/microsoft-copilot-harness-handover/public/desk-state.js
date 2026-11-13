export const statusLabels = {
  bot: 'With assistant', waiting: 'Waiting', human: 'Human support',
  resuming: 'Returning to assistant', handback_failed: 'Needs attention'
};

export class DeskState {
  chats = new Map();
  tabs = [];
  selected = null;
  drafts = new Map();
  attempts = new Map();
  seen = new Map();
  pending = new Map();
  errors = new Map();
  revisions = new Map();
  refreshSequence = 0;
  filter = 'active';
  search = '';
  constructor(operator) { this.operator = operator; }
  startRefresh() {
    return { sequence: ++this.refreshSequence, revisions: new Map(this.revisions), pending: new Set(this.pending.keys()) };
  }
  ingest(chats, snapshot) {
    if (snapshot && snapshot.sequence !== this.refreshSequence) return false;
    const incoming = new Map(chats.map(chat => [chat.id, chat]));
    for (const [id, chat] of this.chats) {
      // A read started before/during a mutation cannot undo its result, even on failure.
      if (snapshot && (snapshot.pending.has(id) || this.pending.has(id)
        || snapshot.revisions.get(id) !== this.revisions.get(id))) incoming.set(id, chat);
    }
    this.chats = incoming;
    this.tabs = this.tabs.filter(id => this.chats.has(id));
    if (!this.chats.has(this.selected)) this.selected = this.tabs[0] ?? null;
    return true;
  }
  select(id) {
    if (!this.chats.has(id)) return;
    if (!this.tabs.includes(id)) this.tabs.push(id);
    this.selected = id;
    this.markSeen(id);
  }
  closeTab(id) {
    const index = this.tabs.indexOf(id);
    this.tabs = this.tabs.filter(tab => tab !== id);
    if (this.selected === id) this.selected = this.tabs[Math.max(0, index - 1)] ?? null;
    if (this.selected) this.markSeen(this.selected);
  }
  markSeen(id) {
    const messages = this.chats.get(id)?.messages;
    if (messages?.length) this.seen.set(id, messages.at(-1).id);
  }
  unread(id) {
    const messages = this.chats.get(id)?.messages ?? [];
    const index = messages.findIndex(message => message.id === this.seen.get(id));
    return messages.slice(index + 1).filter(message => message.role === 'customer').length;
  }
  draft(id) { return this.drafts.get(id) ?? ''; }
  setDraft(id, value) {
    if (this.draft(id) !== value) this.attempts.delete(id);
    this.drafts.set(id, value);
  }
  request(id) {
    if (!this.attempts.has(id)) this.attempts.set(id, { text: this.draft(id), requestId: crypto.randomUUID() });
    return this.attempts.get(id);
  }
  sent(id, request) {
    if (this.draft(id) === request.text) this.setDraft(id, '');
    if (this.attempts.get(id) === request) this.attempts.delete(id);
  }
  begin(id, action) {
    if (this.pending.has(id)) return false;
    this.pending.set(id, action);
    this.revisions.set(id, (this.revisions.get(id) ?? 0) + 1);
    this.errors.delete(id);
    return true;
  }
  finish(id, chat, error) {
    if (chat) this.chats.set(id, chat);
    if (error) this.errors.set(id, error);
    this.pending.delete(id);
    this.revisions.set(id, (this.revisions.get(id) ?? 0) + 1);
  }
  visible() {
    const rank = { waiting: 0, handback_failed: 1, resuming: 2, human: 3, bot: 4 };
    return [...this.chats.values()].filter(chat => {
      if (this.filter === 'active' && chat.mode === 'bot') return false;
      if (this.filter === 'waiting' && chat.mode !== 'waiting') return false;
      if (this.filter === 'mine' && (chat.operator !== this.operator || chat.mode === 'bot')) return false;
      if (this.filter === 'returned' && !(chat.mode === 'bot' && chat.handback)) return false;
      return `${chat.id} ${chat.summary ?? ''} ${chat.reason ?? ''}`.toLowerCase().includes(this.search.toLowerCase());
    }).sort((a, b) => rank[a.mode] - rank[b.mode]
      || (a.messages.at(-1)?.at ?? '').localeCompare(b.messages.at(-1)?.at ?? ''));
  }
}
