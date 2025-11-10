# Showing Agent Reasoning in Custom UIs

> **IMPORTANT!** This is the sample repository for [https://microsoft.github.io/mcscatblog/posts/show-reasoning-agents-sdk/](This article). Follow the article for a more detailed explanation.

Render Anthropic reasoning traces from Microsoft 365 Copilot Studio agents inside your own UI. This README distills the companion article posted on MCS CAT blog.

## Why Bubble Up Reasoning?
- Strengthen trust in automated or assisted decisions.
- Give operators visibility into multi-step, decision-heavy workflows.
- Help end users judge the suitability of an answer before acting on it.

## Demo Scenario
The reference sample (static HTML + JS) simulates an organization triaging monday.com tickets with an Anthropic-enabled Copilot Studio agent. Submitting a new ticket shows incremental reasoning as typing activities, and near-duplicate tickets are merged automatically instead of duplicated.

## Prerequisites
- Copilot Studio agent configured with an Anthropic model (Settings -> Agent model).
- Custom UI wired to the Microsoft 365 Agents SDK.
- Optional backend summarization endpoint to shorten verbose reasoning (recommended for UX). GPT-family models do not yet emit reasoning traces.

## Core Flow
1. **Initialize the client**
   ```js
   import { CopilotStudioClient } from '@microsoft/agents-copilotstudio-client';
   import { acquireToken } from './acquireToken.js';
   import { settings } from './settings.js';

   export const createCopilotClient = async () => {
     const token = await acquireToken(settings);
     return new CopilotStudioClient(settings, token);
   };
   ```
2. **Start a conversation**
   ```js
   const copilotClient = await createCopilotClient();
   let conversationId;

   for await (const act of copilotClient.startConversationAsync(true)) {
     conversationId = act.conversation?.id ?? conversationId;
     if (conversationId) break;
   }
   ```
3. **Send a prompt**
   ```js
   const prompt = `Create the following ticket:\n\nTitle: ${shortTitle}\nDescription: ${longDescription}`;
   const activityStream = copilotClient.askQuestionAsync(prompt, conversationId);
   ```
4. **Capture reasoning and answers**
   ```js
   for await (const activity of activityStream) {
     if (!activity) continue;

     const activityType = activity.type?.toLowerCase();

     if (activityType === 'typing' && activity.channelData?.streamType === 'informative') {
       const streamKey = resolveStreamKey(activity);
       const previousActivity = streamLastActivity.get(streamKey);

       if (previousActivity && isContinuationOfPrevious(previousActivity, activity)) {
         streamLastActivity.set(streamKey, activity);
         continue;
       }

       await flushActivity(previousActivity, false);
       streamLastActivity.set(streamKey, activity);
       continue;
     }

     if (activityType === 'message') {
       agentMessages.push(activity.text);
       continue;
     }
   }
   ```

### Detect Informative Typing
```js
const isReasoningTyping = (activity) =>
  (activity?.type || '').toLowerCase() === 'typing' &&
  activity?.channelData?.streamType === 'informative';
```

## Summarize Long Thoughts
Reasoning chunks can be lengthy. Capture completed thoughts and optionally POST them to a backend summarizer:
```js
async function summarizeSafely(text) {
  try {
    const res = await fetch('/api/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    const { summary } = await res.json();
    return summary.trim();
  } catch {
    return null;
  }
}
```
Keep API keys server-side and apply rate limiting. The sample UI exposes an input control so end users can supply their summarizer key during demos.

## UI Pattern Tips
- Show a calm, rotating status label once users submit a ticket (for example, "Reviewing possible options...").
- Keep the spinner visible while informative typing events are active.
- Prepend the newest summarized reasoning to the top, keeping the latest five items.
- Add a subtle entrance animation and collapse the panel once the final answer arrives, with an optional "Show details" toggle.

## Summary Checklist
1. Switch your agent to an Anthropic model.
2. Iterate the Microsoft 365 Agents SDK activity stream.
3. Detect reasoning via `type === 'typing'` and `channelData.streamType === 'informative'`.
4. Group reasoning chunks by `channelData.streamId`.
5. Flush pending reasoning when you receive the final message.
6. Optionally summarize server-side to protect secrets.
7. Render a compact Thinking panel with recent updates.

## Try It Yourself
- Clone the reference implementation.
- Configure Copilot Studio with an Anthropic model.
- Run the sample locally, observe informative typing streams, and integrate your summarizer.

Questions or feedback on the pattern are welcome.
