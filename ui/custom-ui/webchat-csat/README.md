---
title: Custom CSAT Rating
parent: Custom UI
grand_parent: UI
nav_order: 6
---

# Custom CSAT Rating

This sample shows how to intercept Copilot Studio's built-in CSAT (Customer Satisfaction) survey card and replace it with a custom React component, while sending the exact same payload back to the bot so the conversation flow continues normally.

## What it does

1. **Detects** the CSAT Adaptive Card using a heuristic (walks the card tree looking for `Action.Submit` nodes with a `rate` data key)
2. **Replaces** the default card with a modern emoji-based rating component
3. **Sends back** the same `{ "rate": "N" }` postBack payload the original card would have sent

The sample includes a **mock Direct Line** so you can open `index.html` in a browser and see the custom CSAT component in action without connecting to a real agent.

## How it works

### CSAT detection heuristic

Copilot Studio's `CSATQuestion` node sends an Adaptive Card with five clickable images, each wired to an `Action.Submit` with data like `{ "rate": "1" }` through `{ "rate": "5" }`. The detection function walks the entire card tree and counts how many `Action.Submit` actions carry a `rate` key. If it finds at least 3, it treats the card as a CSAT survey.

{: .note }
> This is a heuristic. If your bot sends other Adaptive Cards whose submit actions also use a `rate` field, this function will match those too. Adjust the detection logic to suit your bot.

### Activity middleware

WebChat's `activityMiddleware` intercepts each activity before it is rendered. When the middleware detects a CSAT card, it returns the custom `CSATRatingActivity` React component instead of letting WebChat render the Adaptive Card:

```javascript
const activityMiddleware =
  () => next => ({ activity, ...otherArgs }) => {
    if (isCSATCard(activity)) {
      return () => <CSATRatingActivity activity={activity} />;
    }
    return next({ activity, ...otherArgs });
  };
```

### Sending the rating back

The custom component uses WebChat's `useSendPostBack()` hook to send the rating. The payload is identical to what the original Adaptive Card's `Action.Submit` would send:

```javascript
sendPostBack({ rate: value }); // value is "1" through "5"
```

## Running the sample

Open `index.html` in a browser. The mock Direct Line will simulate a bot greeting, and after you send any message, the bot will reply with a CSAT card that gets intercepted and replaced with the emoji rating component.

### Connecting to a real agent

Replace the mock Direct Line with a real one by fetching a token from your Copilot Studio token endpoint:

```javascript
const res = await fetch('YOUR_TOKEN_ENDPOINT', { method: 'GET' });
const { token } = await res.json();

// Replace directLine={createMockDirectLine()} with:
directLine={window.WebChat.createDirectLine({ token })}
```

## Based on

- [BotFramework-WebChat password-input sample](https://github.com/microsoft/BotFramework-WebChat/tree/main/samples/05.custom-components/f.password-input) -- same `activityMiddleware` + `useSendPostBack` pattern
