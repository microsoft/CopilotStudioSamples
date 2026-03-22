// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

using Microsoft.Bot.Builder;
using Microsoft.Bot.Schema;
using Newtonsoft.Json;
using System.Collections.Generic;
using System.Linq;
using TranslationBot.Translation.Model;

namespace TranslationBot.Translation.Helpers
{
    public class HandoffHelper
    {
        private const string HandoffInitiateActivityName = "handoff.initiate";
        private const string TranscriptAttachmentName = "transcript";

        public static void InitiateHandoff(string botresponseJson)
        {
            BotResponse response = JsonConvert.DeserializeObject<BotResponse>(botresponseJson);

            // Look for Handoff Initiate Activity. This indicates that conversation needs to be handed off to agent
            Activity handoffInitiateActivity = response.Activities.ToList().FirstOrDefault(
                item => string.Equals(item.Type, ActivityTypes.Event, System.StringComparison.Ordinal)
                && string.Equals(item.Name, HandoffInitiateActivityName, System.StringComparison.Ordinal));

            if (handoffInitiateActivity != null)
            {
                // Read transcript from attachment
                if (handoffInitiateActivity.Attachments?.Any() == true)
                {
                    Attachment transcriptAttachment = handoffInitiateActivity.Attachments.FirstOrDefault(
                        a => string.Equals(a.Name.ToLowerInvariant(), TranscriptAttachmentName, System.StringComparison.Ordinal));
                    if (transcriptAttachment != null)
                    {
                        Transcript transcript = JsonConvert.DeserializeObject<Transcript>(
                            transcriptAttachment.Content.ToString());
                    }
                }

                // Read handoff context
                HandoffContext context = JsonConvert.DeserializeObject<HandoffContext>(handoffInitiateActivity.Value.ToString());
                
                // Connect to Agent
                Dictionary<string, object> contextVars = new Dictionary<string, object>() { { "HandoffContext", context } };
                //OmnichannelBotClient.AddEscalationContext(handoffInitiateActivity, contextVars);
            }
        }
    }
}
