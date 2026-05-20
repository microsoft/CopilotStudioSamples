// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

using Microsoft.Bot.Connector.DirectLine;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Threading;
using System;
using System.Linq;
using Microsoft.Extensions.Configuration;

namespace TranslationBot.Translation
{
    public class DirectLineService
    {
        private const int _botReplyWaitIntervalInMilSec = 3000;
        private string _botName;

        public DirectLineService(IConfiguration configuration)
        {
            _botName = configuration["BotName"];
        }

        /// <summary>
        /// Use directlineClient to start the conversation and get the conversationId
        /// </summary>
        /// <returns>Token generated</returns>
        /// <param name="activity">activity to be sent</param>
        public async Task<string> StartConversation(string token)
        {
            using (var directLineClient = new DirectLineClient(token))
            {
                var conversation = await directLineClient.Conversations.StartConversationAsync();
                return conversation.ConversationId;
            }
        }

        /// <summary>
        /// Use directlineClient to post the user message
        /// </summary>
        /// <returns>Activity set</returns>
        /// <param name="activity">activity to be sent</param>
        /// <param name="token">current token</param>
        /// <param name="conversationId">current conversation ID</param>
        /// <param name="watermark">current watermark</param>
        public async Task<ActivitySet> PostUserMessage(Activity activity, string token, string conversationId, string watermark)
        {
            using (var directLineClient = new DirectLineClient(token))
            {
                // Send user message using directlineClient
                var res = await directLineClient.Conversations.PostActivityAsync(conversationId, activity);

                Thread.Sleep(_botReplyWaitIntervalInMilSec);

                // Get bot response using directlinClient
                var responses = await GetBotResponseActivitiesAsync(directLineClient, conversationId, watermark);
                return responses;
            }
        }

        /// <summary>
        /// Use directlineClient to get bot response
        /// </summary>
        /// <returns>Activity set</returns>
        /// <param name="directLineClient">directline client</param>
        /// <param name="conversationtId">current conversation ID</param>
        /// <param name="watermark">current watermark</param>
        private async Task<ActivitySet> GetBotResponseActivitiesAsync(DirectLineClient directLineClient, string conversationtId, string watermark)
        {
            ActivitySet response = null;
            List<Activity> result = new List<Activity>();

            do
            {
                response = await directLineClient.Conversations.GetActivitiesAsync(conversationtId, watermark);
                if (response == null)
                {
                    // response can be null if directLineClient token expires
                    // TODO
                }

                result = response?.Activities?.Where(x =>
                    x.Type == ActivityTypes.Message &&
                    string.Equals(x.From.Name, _botName, StringComparison.Ordinal)).ToList();

                if (result != null && result.Any())
                {
                    return new ActivitySet()
                    {
                        Watermark = response?.Watermark,
                        Activities = result
                    };
                }

                Thread.Sleep(1000);
            } while (response != null && response.Activities.Any());

            return new ActivitySet();
        }
    }
}
