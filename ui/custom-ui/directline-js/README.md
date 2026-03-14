---
title: DirectLine JS
parent: Custom UI
grand_parent: UI
nav_order: 1
---
# DirectLine JS Sample

A minimal, self-contained sample that connects to a **Copilot Studio** agent using Microsoft's open-source [`botframework-directlinejs`](https://github.com/microsoft/BotFramework-DirectLineJS) library — **without WebChat**. The UI is fully custom: plain HTML, CSS, and vanilla JavaScript.

## What it demonstrates

1. **Token acquisition** — fetch a DirectLine token from the Copilot Studio token endpoint (no authentication required for agents without enhanced security)
2. **Regional endpoint discovery** — use the `regionalchannelsettings` API to get the correct DirectLine URL (agents are deployed regionally — never hardcode `directline.botframework.com`)
3. **DirectLine connection** — create a `DirectLine` instance with WebSocket transport
4. **Connection status monitoring** — react to `connectionStatus$` (Online, ExpiredToken, FailedToConnect, etc.)
5. **Greeting trigger** — send a `startConversation` event to fire the agent's Greeting topic
6. **Receiving activities** — subscribe to `activity$`, filter by `from.role === 'bot'`, and deduplicate
7. **Markdown rendering** — agent responses are markdown; rendered with the [marked](https://github.com/markedjs/marked) library
8. **Citation sources** — extract citation metadata from `schema.org/Message` entities and display as a Sources footer
9. **Suggested actions** — render quick-reply buttons from `activity.suggestedActions`
10. **Typing indicators** — animated dots while the agent is processing

## Setup

1. Copy the config template and fill in your token endpoint:

   ```bash
   cp config.sample.js config.js
   ```

   To find your token endpoint: **Copilot Studio → Settings → Channels → Mobile app** → copy the Token Endpoint URL.

2. Serve the files locally:

   ```bash
   npx serve . -l 5510
   ```

3. Open http://localhost:5510

## Code snippets

### Connect to Copilot Studio

```js
// Fetch token and regional endpoint (both derived from the token endpoint URL)
const tokenEndpoint = 'https://<env>.environment.api.powerplatform.com/.../directline/token?api-version=2022-03-01-preview';
const apiVersion = new URL(tokenEndpoint).searchParams.get('api-version');

const [{ channelUrlsById }, { token }] = await Promise.all([
  fetch(new URL(`/powervirtualagents/regionalchannelsettings?api-version=${apiVersion}`, tokenEndpoint)).then(r => r.json()),
  fetch(tokenEndpoint).then(r => r.json()),
]);

const directLine = new DirectLine.DirectLine({
  token,
  domain: new URL('v3/directline', channelUrlsById.directline).toString(),
  webSocket: true,
});
```

### Receive activities

```js
directLine.activity$
  .filter(activity => {
    // Only agent activities — DirectLine echoes back your own messages
    // with from.role undefined; the agent's always have from.role === 'bot'
    return activity.from.role === 'bot';
  })
  .subscribe(activity => {
    if (activity.type === 'message') console.log('Agent:', activity.text);
    if (activity.type === 'typing')  console.log('Agent is typing...');
  });
```

### Send a message

```js
// postActivity returns an RxJS Observable — you MUST subscribe to trigger the send
directLine.postActivity({
  from: { id: 'user1' },
  type: 'message',
  text: 'Hello!',
}).subscribe(
  id => console.log('Sent, id:', id),
  err => console.error('Error:', err),
);
```

### Trigger the greeting topic

```js
directLine.postActivity({
  from: { id: 'user1' },
  type: 'event',
  name: 'startConversation',
}).subscribe();
```

## Key gotchas

- **`from.role`, not `from.id`** — DirectLine replaces your `from.id` with a server-assigned UUID. To distinguish agent activities from user echoes, filter on `from.role === 'bot'` (the protocol still uses "bot" as the role value).
- **Deduplication** — DirectLine may deliver the same activity twice (WebSocket + polling fallback). Track seen activity IDs to prevent duplicate rendering.
- **Lazy Observables** — `postActivity()` returns an RxJS Observable. You must call `.subscribe()` to actually send the request.
- **RxJS 5.x** — the library bundles RxJS 5, which uses chainable `.filter().subscribe()` (not the `.pipe()` syntax from RxJS 6+).

## Files

| File | Description |
|------|-------------|
| `index.html` | Complete sample — HTML + CSS + JS in a single file |
| `config.sample.js` | Configuration template (token endpoint URL) |
| `config.js` | Your local config (gitignored) |
