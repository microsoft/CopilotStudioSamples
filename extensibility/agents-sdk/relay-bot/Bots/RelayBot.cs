// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

using Microsoft.Bot.Builder;
using Microsoft.Bot.Connector.DirectLine;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using DirectLineActivity = Microsoft.Bot.Connector.DirectLine.Activity;
using DirectLineActivityTypes = Microsoft.Bot.Connector.DirectLine.ActivityTypes;
using IConversationUpdateActivity = Microsoft.Bot.Schema.IConversationUpdateActivity;
using IMessageActivity = Microsoft.Bot.Schema.IMessageActivity;

namespace Microsoft.PowerVirtualAgents.Samples.RelayBotSample.Bots
{
    /// <summary>
    /// This IBot implementation shows how to connect
    /// an external Azure Bot Service channel bot (external bot)
    /// to your Power Virtual Agent bot
    /// </summary>
    public class RelayBot : ActivityHandler
    {
        private const int WaitForBotResponseMaxMilSec = 5 * 1000;
        private const int PollForBotResponseIntervalMilSec = 1000;
        private static ConversationManager s_conversationManager = ConversationManager.Instance;
        private ResponseConverter _responseConverter;
        private IBotService _botService;

        public RelayBot(IBotService botService, ConversationManager conversationManager)
        {
            _botService = botService;
            _responseConverter = new ResponseConverter();
        }

        // Invoked when a conversation update activity is received from the external Azure Bot Service channel
        // Start a Power Virtual Agents bot conversation and store the mapping
        protected override async Task OnConversationUpdateActivityAsync(ITurnContext<IConversationUpdateActivity> turnContext, CancellationToken cancellationToken)
        {
            await s_conversationManager.GetOrCreateBotConversationAsync(turnContext.Activity.Conversation.Id, _botService);
        }

        // Invoked when a message activity is received from the user
        // Send the user message to Power Virtual Agent bot and get response
        protected override async Task OnMessageActivityAsync(ITurnContext<IMessageActivity> turnContext, CancellationToken cancellationToken)
        {
            var currentConversation = await s_conversationManager.GetOrCreateBotConversationAsync(turnContext.Activity.Conversation.Id, _botService);

            using (DirectLineClient client = new DirectLineClient(currentConversation.Token))
            {
                // Send user message using directlineClient
                await client.Conversations.PostActivityAsync(currentConversation.ConversationtId, new DirectLineActivity()
                {
                    Type = DirectLineActivityTypes.Message,
                    From = new ChannelAccount { Id = turnContext.Activity.From.Id, Name = turnContext.Activity.From.Name },
                    Text = turnContext.Activity.Text,
                    TextFormat = turnContext.Activity.TextFormat,
                    Locale = turnContext.Activity.Locale,
                });

                await RespondPowerVirtualAgentsBotReplyAsync(client, currentConversation, turnContext);
            }

            // Update LastConversationUpdateTime for session management
            currentConversation.LastConversationUpdateTime = DateTime.Now;
        }

        private async Task RespondPowerVirtualAgentsBotReplyAsync(DirectLineClient client, RelayConversation currentConversation, ITurnContext<IMessageActivity> turnContext)
        {
            var retryMax = WaitForBotResponseMaxMilSec / PollForBotResponseIntervalMilSec;
            for (int retry = 0; retry < retryMax; retry++)
            {
                // Get bot response using directlineClient,
                // response contains whole conversation history including user & bot's message
                ActivitySet response = await client.Conversations.GetActivitiesAsync(currentConversation.ConversationtId, currentConversation.WaterMark);

                // Filter bot's reply message from response
                List<DirectLineActivity> botResponses = response?.Activities?.Where(x =>
                      x.Type == DirectLineActivityTypes.Message &&
                        string.Equals(x.From.Name, _botService.GetBotName(), StringComparison.Ordinal)).ToList();

                if (botResponses?.Count() > 0)
                {
                    if (int.Parse(response?.Watermark ?? "0") <= int.Parse(currentConversation.WaterMark ?? "0"))
                    {
                        // means user sends new message, should break previous response poll
                        return;
                    }

                    currentConversation.WaterMark = response.Watermark;
                    await turnContext.SendActivitiesAsync(_responseConverter.ConvertToBotSchemaActivities(botResponses).ToArray());
                }

                Thread.Sleep(PollForBotResponseIntervalMilSec);
            }
        }
    }
}
