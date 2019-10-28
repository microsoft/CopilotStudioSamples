// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

using Microsoft.Bot.Connector.DirectLine;
using System;
using System.Collections.Generic;
using System.Configuration;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace Microsoft.PowerVirtualAgents.Samples.BotConnectorApp
{
    public class BotConnectorApp
    {
        private static string _watermark = null;
        private const int _botReplyWaitIntervalInMilSec = 3000;
        private const string _botDisplayName = "Bot";
        private const string _userDisplayName = "You";
        private static string s_endConversationMessage;
        private static BotService s_botService;

        /// <summary>
        /// Start BotConnectorApp console
        /// See <see cref="README.md"/> for information on how to update bot settings in App.config
        /// Takes user input and output bot reply, until user types EndConversationMessage
        /// </summary>
        public static void Main(string[] args)
        {
            var botId = ConfigurationManager.AppSettings["BotId"] ?? string.Empty;
            var tenantId = ConfigurationManager.AppSettings["BotTenantId"] ?? string.Empty;
            var botTokenEndpoint = ConfigurationManager.AppSettings["BotTokenEndpoint"] ?? string.Empty;
            var botName = ConfigurationManager.AppSettings["BotName"] ?? string.Empty;
            s_endConversationMessage = ConfigurationManager.AppSettings["EndConversationMessage"] ?? "quit";
            if (string.IsNullOrEmpty(botId) || string.IsNullOrEmpty(tenantId) || string.IsNullOrEmpty(botTokenEndpoint) || string.IsNullOrEmpty(botName))
            {
                Console.WriteLine("Update App.config and start again.");
                Console.WriteLine("Press any key to exit");
                Console.Read();
                Environment.Exit(0);
            }

            s_botService = new BotService()
            {
                BotName = botName,
                BotId = botId,
                TenantId = tenantId,
                TokenEndPoint = botTokenEndpoint,
            };
            StartConversation().Wait();
        }

        private static async Task StartConversation()
        {
            var token = await s_botService.GetTokenAsync();
            using (var directLineClient = new DirectLineClient(token))
            {
                var conversation = await directLineClient.Conversations.StartConversationAsync();
                var conversationtId = conversation.ConversationId;
                string inputMessage;

                while (!string.Equals(inputMessage = GetUserInput(), s_endConversationMessage, StringComparison.OrdinalIgnoreCase))
                {
                    // Send user message using directlineClient
                    await directLineClient.Conversations.PostActivityAsync(conversationtId, new Activity()
                    {
                        Type = ActivityTypes.Message,
                        From = new ChannelAccount { Id = "userId", Name = "userName" },
                        Text = inputMessage,
                        TextFormat = "plain",
                        Locale = "en-Us",
                    });

                    Console.WriteLine($"{_botDisplayName}:");
                    Thread.Sleep(_botReplyWaitIntervalInMilSec);

                    // Get bot response using directlinClient
                    List<Activity> responses = await GetBotResponseActivitiesAsync(directLineClient, conversationtId);
                    BotReply(responses);
                }
            }
        }

        /// <summary>
        /// Prompt for user input
        /// </summary>
        /// <returns>user message as string</returns>
        private static string GetUserInput()
        {
            Console.WriteLine($"{_userDisplayName}:");
            var inputMessage = Console.ReadLine();
            return inputMessage;
        }

        /// <summary>
        /// Use directlineClient to get bot response
        /// </summary>
        /// <returns>List of DirectLine activities</returns>
        /// <param name="directLineClient">directline client</param>
        /// <param name="conversationtId">current conversation ID</param>
        /// <param name="botName">name of bot to connect to</param>
        private static async Task<List<Activity>> GetBotResponseActivitiesAsync(DirectLineClient directLineClient, string conversationtId)
        {
            ActivitySet response = null;
            List<Activity> result = new List<Activity>();

            do
            {
                response = await directLineClient.Conversations.GetActivitiesAsync(conversationtId, _watermark);
                if (response == null)
                {
                    // response can be null if directLineClient token expires
                    Console.WriteLine("Conversation expired. Press any key to exit.");
                    Console.Read();
                    directLineClient.Dispose();
                    Environment.Exit(0);
                }

                _watermark = response?.Watermark;
                result = response?.Activities?.Where(x =>
                  x.Type == ActivityTypes.Message &&
                    string.Equals(x.From.Name, s_botService.BotName, StringComparison.Ordinal)).ToList();

                if (result != null && result.Any())
                {
                    return result;
                }

                Thread.Sleep(1000);
            } while (response != null && response.Activities.Any());

            return new List<Activity>();
        }

        /// <summary>
        /// Print bot reply to console
        /// </summary>
        /// <param name="responses">List of DirectLine activities <see cref="https://github.com/Microsoft/botframework-sdk/blob/master/specs/botframework-activity/botframework-activity.md"/>
        /// </param>
        private static void BotReply(List<Activity> responses)
        {
            responses?.ForEach(responseActivity =>
            {
                // responseActivity is standard Microsoft.Bot.Connector.DirectLine.Activity
                // See https://github.com/Microsoft/botframework-sdk/blob/master/specs/botframework-activity/botframework-activity.md for reference
                // Showing examples of Text & SuggestedActions in response payload
                if (!string.IsNullOrEmpty(responseActivity.Text))
                {
                    Console.WriteLine(string.Join(Environment.NewLine, responseActivity.Text));
                }

                if (responseActivity.SuggestedActions != null && responseActivity.SuggestedActions.Actions != null)
                {
                    var options = responseActivity.SuggestedActions?.Actions?.Select(a => a.Title).ToList();
                    Console.WriteLine($"\t{string.Join(" | ", options)}");
                }
            });
        }
    }
}
