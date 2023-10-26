using BotConnectorApp.Service;
using BotConnectorApp.Service.Models;
using Microsoft.Bot.Connector.DirectLine;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace BotConnectorApp
{
    public class Program
    {
        private static string _watermark = null;
        private static IBotService _botService;
        private static AppSettings _appSettings;
        private static string _endConversationMessage;
        private static string _userDisplayName = "You";


        public static void Main(string[] args)
        {
            var configuration = new ConfigurationBuilder()
                               .AddJsonFile("appsettings.json")
                               .AddEnvironmentVariables()
                               .Build();

            _appSettings = configuration.GetRequiredSection("Settings").Get<AppSettings>();
            _endConversationMessage = _appSettings.EndConversationMessage ?? "quit";
            
            var serviceProvider = new ServiceCollection()
                                .AddLogging()
                                .AddSingleton<IBotService, BotService>()                
                                .BuildServiceProvider();

            _botService = serviceProvider.GetService<IBotService>();

            if (string.IsNullOrEmpty(_appSettings.BotId) || string.IsNullOrEmpty(_appSettings.BotTenantId) || string.IsNullOrEmpty(_appSettings.BotTokenEndpoint) || string.IsNullOrEmpty(_appSettings.BotName))
            {
                Console.WriteLine("Update appsettings and start again.");
                Console.WriteLine("Press any key to exit");
                Console.Read();
                Environment.Exit(0);
            }
            StartConversation().Wait();
        }


        public static async Task StartConversation()
        {
            var directLineToken = await _botService.GetTokenAsync(_appSettings.BotTokenEndpoint);
            using (var directLineClient = new DirectLineClient(directLineToken.Token))
            {
                var conversation = await directLineClient.Conversations.StartConversationAsync();
                var conversationtId = conversation.ConversationId;
                string inputMessage;

                while (!string.Equals(inputMessage = GetUserInput(), _appSettings.EndConversationMessage, StringComparison.OrdinalIgnoreCase))
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

                    Console.WriteLine($"{_appSettings.BotName}:");
                    Thread.Sleep(3000);

                    // Get bot response using directlinClient
                    List<Activity> responses = await GetBotResponseActivitiesAsync(directLineClient, conversationtId);
                    BotReply(responses);
                }
            }
        }


        /// <summary>
        /// Use directlineClient to get bot response
        /// </summary>
        /// <returns>List of DirectLine activities</returns>
        /// <param name="directLineClient">directline client</param>
        /// <param name="conversationtId">current conversation ID</param>
        /// <param name="botName">name of bot to connect to</param>// <summary>        
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
                    string.Equals(x.From.Name, _appSettings.BotName, StringComparison.Ordinal)).ToList();

                if (result != null && result.Any())
                {
                    return result;
                }

                Thread.Sleep(1000);
            } while (response != null && response.Activities.Any());

            return new List<Activity>();
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