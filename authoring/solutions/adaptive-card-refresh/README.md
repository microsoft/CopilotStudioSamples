---
title: Adaptive Card Refresh
parent: Solutions
grand_parent: Authoring
nav_order: 7
---
# Adaptive Card Refresh (Universal Actions)

Refresh or replace an Adaptive Card the moment a user submits it in Microsoft Teams,
so a completed form can't be filled in or submitted twice.

By default, an Adaptive Card stays interactive after a user clicks **Submit**: the
inputs clear, the card still looks fillable, and the user gets no confirmation that
their response was received. This solution fixes that using the
[Universal Action model](https://learn.microsoft.com/en-us/adaptive-cards/authoring-cards/universal-action-model):
the card's buttons use `Action.Execute` with a unique `verb`, a listener topic
catches the resulting invoke activity, branches on the verb, and returns a
replacement card that Teams swaps in place.

![Adaptive Card refresh demo](./assets/RefreshAdaptiveCard.gif)

{: .note }
> **Attribution.** This solution was authored by **Nghiem Doan** and is included here
> under its original MIT license (see [`LICENSE`](https://github.com/microsoft/CopilotStudioSamples/blob/main/authoring/solutions/adaptive-card-refresh/LICENSE)). Original repository:
> [nghiemdoan-msft/AdaptiveCardInCopilotStudio](https://github.com/nghiemdoan-msft/AdaptiveCardInCopilotStudio).

## How it works

1. **Design the card with `Action.Execute`.** Instead of `Action.Submit`, each button
   uses `Action.Execute` with a unique `verb` (for example `feedbackSubmitForm` and
   `feedbackSkipForm`) and `"fallback": "Action.Submit"` for clients that don't
   support Universal Actions.
2. **Display it with a "Send a message" node.** Do not use "Ask with Adaptive Card",
   because that node uses `Action.Submit` internally and won't trigger the invoke/refresh flow.
3. **Listen for the invoke.** A topic triggered by **Invoke Received** parses the
   activity payload and reads `resultData.action.verb`.
4. **See the raw payload (debug).** The listener's first action sends the invoke
   payload back as a message, prefixed with `Debug (remove for production)`, so you
   can inspect the verb and submitted form data while learning. Delete this
   `SendActivity` node before shipping so submitted values are not shown as raw chat.
5. **Return a replacement card.** The listener branches on the verb and returns the
   Universal Action response format, and Teams replaces the original card in place:

   ```json
   {
     "statusCode": 200,
     "type": "application/vnd.microsoft.card.adaptive",
     "value": { "type": "AdaptiveCard", "body": [] }
   }
   ```

{: .note }
> The `Debug (remove for production)` message in `CardListenerV2` is intentional for
> learning: it surfaces the raw Universal Action payload (verb + form data) so you can
> see what the invoke carries. Remove that first `SendActivity` node before you publish
> the agent, otherwise submitted ratings and comments appear as a raw chat message.

## What's in the solution

| Topic | Role |
|---|---|
| `CaptureFeedbackV2` | Displays the survey Adaptive Card (`Action.Execute` buttons) |
| `CardListenerV2` | Listens for the invoke activity and returns the replacement card |

The package also contains the default Copilot Studio system topics (Conversation Start,
Greeting, Escalate, Fallback, and so on), unchanged from a new agent.

Unpacked source (PnP format) is in [`sourcecode/`](https://github.com/microsoft/CopilotStudioSamples/tree/main/authoring/solutions/adaptive-card-refresh/sourcecode); the importable
package is in [`solution/`](https://github.com/microsoft/CopilotStudioSamples/tree/main/authoring/solutions/adaptive-card-refresh/solution).

## Prerequisites

- A Power Platform environment with Microsoft Copilot Studio enabled.
- Permission to import solutions at [make.powerapps.com](https://make.powerapps.com).
- A Microsoft Teams channel to test the invoke/refresh flow.

No connection references or environment variables are required; the solution contains
only topics.

## Importing

1. Download [`solution/FeedbackAgent_1_0_0_5.zip`](https://github.com/microsoft/CopilotStudioSamples/blob/main/authoring/solutions/adaptive-card-refresh/solution/FeedbackAgent_1_0_0_5.zip).
2. Go to [make.powerapps.com](https://make.powerapps.com) > **Solutions** > **Import solution**.
3. Select the zip, then **Next** > **Import**.
4. Open the imported **FeedbackAgent** in Copilot Studio and **Publish** it.
5. Add the **Microsoft Teams** channel.

{: .warning }
> Test in **Teams**, not the Copilot Studio test canvas. The invoke/refresh flow only
> runs in a published channel, so the card replacement won't appear in the test panel.

## Notes and trade-offs

- **Teams-specific.** The invoke/refresh flow relies on the Teams channel. For custom
  web portals built on BotFramework-WebChat, use the client-side attachment middleware
  pattern instead. Neither pattern applies in the Microsoft 365 Copilot channel today.
- **Publish to debug.** Because the invoke response only works in a published channel,
  you'll need to publish the agent to test each change.

## Related reading

- Blog walkthrough: [Disabling Adaptive Cards After Submission in Copilot Studio Agents](https://microsoft.github.io/mcscatblog/posts/disable-adaptive-cards-after-submission/)
- [Universal Action model](https://learn.microsoft.com/en-us/adaptive-cards/authoring-cards/universal-action-model)
- [Send a message node](https://learn.microsoft.com/microsoft-copilot-studio/authoring-send-message)
