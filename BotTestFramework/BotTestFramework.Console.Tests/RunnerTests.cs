using BotTestFramework.Console.Helpers.DirectLine;
using BotTestFramework.Console.Helpers.FileHandler;
using BotTestFramework.Console.Models.DirectLine;
using Microsoft.Bot.Connector.DirectLine;
using Moq;
using Newtonsoft.Json;
using Serilog;

namespace BotTestFramework.Console.Tests
{
    public class RunnerTests
	{
        private DirectLineOptions _dlOptions;
        private Mock<DirectLineClientBase> _directLineClient;
        private Mock<IFileHandler> _fileHandler;
        private Mock<ILogger> _logger;
        private List<Activity> _simpleActivityList;
        private List<Activity> _multipleActivityList;
        private List<Activity> _simpleAndMultipleActivityList;
        private List<Activity> _dymActivityList;
        private List<Activity> _adaptiveCardActivityList;
        private readonly string _passTestFolder = Directory.GetCurrentDirectory() + @"\Files\Pass";
        private readonly string _failTestFolder = Directory.GetCurrentDirectory() + @"\Files\Fail";
        private readonly string _chatFolder = Directory.GetCurrentDirectory() + @"\Files\Chat";

        [SetUp]
		public void Setup()
		{
            _dlOptions = new DirectLineOptions("https://tokenEndpoint.test", new Uri("https://regionalEndpoint.test"));

            _directLineClient = new Mock<DirectLineClientBase>();
            _directLineClient.Setup(client => client.SendActivityAsync(It.IsAny<Activity>(), It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

            _fileHandler = new Mock<IFileHandler>();
            _fileHandler.Setup(file => file.CheckFilePath(It.IsAny<string>()));
            _fileHandler.Setup(file => file.DeleteFile(It.IsAny<string>()));
            _fileHandler.Setup(file => file.GetFullPath(It.IsAny<string>())).Returns("x:\\testpath.json");
            _fileHandler.Setup(file => file.WriteToFile(It.IsAny<string>(), It.IsAny<string>()));
            _fileHandler.Setup(file => file.GetFileAttributes(It.IsAny<string>())).Returns(FileAttributes.Normal);

            _logger = new Mock<ILogger>();
            _logger.Setup(logger => logger.Information(It.IsAny<string>()));
            _logger.Setup(logger => logger.Warning(It.IsAny<string>()));
            _logger.Setup(logger => logger.Error(It.IsAny<string>()));
            _logger.Setup(logger => logger.Fatal(It.IsAny<string>()));
            _logger.Setup(logger => logger.ForContext(It.IsAny<string>(), It.IsAny<object>(), false)).Returns(_logger.Object);

            _simpleActivityList = new List<Activity>
            {
                new Activity()
                {
                    From = new ChannelAccount()
                    {
                        Id = Guid.NewGuid().ToString()
                    },
                    Type = "message",
                    Text = "Hello!",
                    Conversation = new ConversationAccount() { Id = Guid.NewGuid().ToString() }
                }
            };

            _multipleActivityList = new List<Activity>
            {
                new Activity()
                {
                    From = new ChannelAccount()
                    {
                        Id = Guid.NewGuid().ToString()
                    },
                    Type = "message",
                    Text = "Hello!",
                    Conversation = new ConversationAccount() { Id = Guid.NewGuid().ToString() }
                },
                new Activity()
                {
                    From = new ChannelAccount()
                    {
                        Id = Guid.NewGuid().ToString()
                    },
                    Type = "message",
                    Text = "Hello!",
                    Conversation = new ConversationAccount() { Id = Guid.NewGuid().ToString() }
                },
                new Activity()
                {
                    From = new ChannelAccount()
                    {
                        Id = Guid.NewGuid().ToString()
                    },
                    Type = "message",
                    Text = "Hello!",
                    Conversation = new ConversationAccount() { Id = Guid.NewGuid().ToString() }
                }
            };

            _dymActivityList = new List<Activity>
            {
                new Activity()
                {
                    From = new ChannelAccount()
                    {
                        Id = Guid.NewGuid().ToString()
                    },
                    Type = "trace",
                    Text = "To clarify, did you mean:",
                    SuggestedActions = new SuggestedActions()
                    { 
                        Actions = new List<CardAction>()
                        {
                            new CardAction() { Title = "Open Hours" },
                            new CardAction() { Title = "Buy Vitamins" },
                            new CardAction() { Title = "Test Vitamins" },
                            new CardAction() { Title = "None of these" },
                        }
                    },
                    Conversation = new ConversationAccount() { Id = Guid.NewGuid().ToString() }
                }
            };

            var adaptive1 = JsonConvert.DeserializeObject<Attachment>("{\"content\":{\"type\":\"AdaptiveCard\",\"body\":[{\"type\":\"ColumnSet\",\"columns\":[{\"type\":\"Column\",\"items\":[{\"type\":\"Image\",\"url\":\"https://i.imgur.com/CNmYsD2.jpeg\"}],\"width\":\"auto\"}]},{\"type\":\"TextBlock\",\"size\":\"medium\",\"weight\":\"bolder\",\"text\":\"CVS Health Vitamin D Softgels 2000IU\",\"wrap\":true},{\"type\":\"TextBlock\",\"size\":\"medium\",\"weight\":\"bolder\",\"text\":\"$9.99\",\"wrap\":true},{\"type\":\"TextBlock\",\"text\":\"Vitamin D is an essential nutrient that works with Calcium to help develop strong bones and teeth.* This high-potency Vitamin D supplement also assists in maintaining a healthy immune system.* These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease.\",\"wrap\":true},{\"type\":\"Container\",\"items\":[{\"type\":\"ActionSet\",\"actions\":[{\"type\":\"Action.Submit\",\"title\":\"Buy\",\"style\":\"positive\",\"data\":{\"id\":\"_qkQW8dJlUeLVi7ZMEzYVw\",\"action\":\"buy_1\"}}]}]}],\"$schema\":\"http://adaptivecards.io/schemas/adaptive-card.json\",\"version\":\"1.3\"}}");
            var adaptive2 = JsonConvert.DeserializeObject<Attachment>("{\"content\":{\"type\":\"AdaptiveCard\",\"body\":[{\"type\":\"ColumnSet\",\"columns\":[{\"type\":\"Column\",\"items\":[{\"type\":\"Image\",\"url\":\"https://i.imgur.com/CQjvhfu.jpeg\"}],\"width\":\"auto\"}]},{\"type\":\"TextBlock\",\"size\":\"medium\",\"weight\":\"bolder\",\"text\":\"CVS Health Vitamin B12 Tablets 1000mcg\",\"wrap\":true},{\"type\":\"TextBlock\",\"size\":\"medium\",\"weight\":\"bolder\",\"text\":\"$11.79\",\"wrap\":true},{\"type\":\"TextBlock\",\"text\":\"Vitamin B12 supports healthy blood cells and nervous system health.* It is also involved in energy metabolism by converting food into energy.*These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease.\",\"wrap\":true},{\"type\":\"Container\",\"items\":[{\"type\":\"ActionSet\",\"actions\":[{\"type\":\"Action.Submit\",\"title\":\"Buy\",\"style\":\"positive\",\"data\":{\"id\":\"_qkQW8dJlUeLVi7ZMEzYVw\",\"action\":\"buy_2\"}}]}]}],\"$schema\":\"http://adaptivecards.io/schemas/adaptive-card.json\",\"version\":\"1.3\"}}");
            var adaptive3 = JsonConvert.DeserializeObject<Attachment>("{\"content\":{\"type\":\"AdaptiveCard\",\"body\":[{\"type\":\"ColumnSet\",\"columns\":[{\"type\":\"Column\",\"items\":[{\"type\":\"Image\",\"url\":\"https://i.imgur.com/0uCIfXd.jpeg\"}],\"width\":\"auto\"}]},{\"type\":\"TextBlock\",\"size\":\"medium\",\"weight\":\"bolder\",\"text\":\"CVS Health Vitamin C Caplets 1000mg\",\"wrap\":true},{\"type\":\"TextBlock\",\"size\":\"medium\",\"weight\":\"bolder\",\"text\":\"$14.99\",\"wrap\":true},{\"type\":\"TextBlock\",\"text\":\"Vitamin C is an essential nutrient that provides antioxidant and immune system health support. Vitamin C is also involved in collagen formation, which is important for healthy skin and connective tissue.\\r\\nDisclaimer: These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure or prevent any disease.\",\"wrap\":true},{\"type\":\"Container\",\"items\":[{\"type\":\"ActionSet\",\"actions\":[{\"type\":\"Action.Submit\",\"title\":\"Buy\",\"style\":\"positive\",\"data\":{\"id\":\"_qkQW8dJlUeLVi7ZMEzYVw\",\"action\":\"buy_3\"}}]}]}],\"$schema\":\"http://adaptivecards.io/schemas/adaptive-card.json\",\"version\":\"1.3\"}}");
            var adaptive4 = JsonConvert.DeserializeObject<Attachment>("{\"content\":{\"type\":\"AdaptiveCard\",\"body\":[{\"type\":\"ColumnSet\",\"columns\":[{\"type\":\"Column\",\"items\":[{\"type\":\"Image\",\"url\":\"https://i.imgur.com/uxPY1SM.jpeg\"}],\"width\":\"auto\"}]},{\"type\":\"TextBlock\",\"size\":\"medium\",\"weight\":\"bolder\",\"text\":\"Nature Made Vitamin D3 + K2 Softgels, 30 CT\",\"wrap\":true},{\"type\":\"TextBlock\",\"size\":\"medium\",\"weight\":\"bolder\",\"text\":\"$16.79\",\"wrap\":true},{\"type\":\"TextBlock\",\"text\":\"Nature Made Vitamin D3 + K2 Softgels are dietary supplements that combine Vitamin D 5000 IU (125 mcg) with Vitamin K2 100 mcg to support strong, healthy bones. Sourced from high-quality ingredients, this gluten free Vitamin D3 supplement contains no synthetic dyes and no artificial flavors.\",\"wrap\":true},{\"type\":\"Container\",\"items\":[{\"type\":\"ActionSet\",\"actions\":[{\"type\":\"Action.Submit\",\"title\":\"Buy\",\"style\":\"positive\",\"data\":{\"id\":\"_qkQW8dJlUeLVi7ZMEzYVw\",\"action\":\"buy_4\"}}]}]}],\"$schema\":\"http://adaptivecards.io/schemas/adaptive-card.json\",\"version\":\"1.3\"}}");

            _adaptiveCardActivityList = new List<Activity>
            {
                new Activity()
                {
                    From = new ChannelAccount()
                    {
                        Id = Guid.NewGuid().ToString()
                    },
                    Type = "message",
                    Attachments = new List<Attachment>()
                    {
                        new Attachment() { Content = adaptive1.Content },
                        new Attachment() { Content = adaptive2.Content },
                        new Attachment() { Content = adaptive3.Content },
                        new Attachment() { Content = adaptive4.Content }
                    },
                    Conversation = new ConversationAccount() { Id = Guid.NewGuid().ToString() }
                }
            };

            _simpleAndMultipleActivityList = new List<Activity>();
            _simpleAndMultipleActivityList.AddRange(_simpleActivityList);
            _simpleAndMultipleActivityList.AddRange(_multipleActivityList);
        }

		[Test]
		public async Task RunTranscriptTestAsyncWithSingleConversationPassed()
		{
            _directLineClient.Setup(client => client.ReceiveActivitiesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(_simpleActivityList);
            var testRunner = new Mock<Runner>(_logger.Object, _directLineClient.Object, _fileHandler.Object);
			var result = await testRunner.Object.RunTranscriptTestAsync(_dlOptions, Path.Combine(_passTestFolder, "simple.json"), false);
			Assert.IsTrue(result);
		}

        [Test]
        public async Task RunTranscriptTestAsyncWithSingleConversationFailed()
        {
            _directLineClient.Setup(client => client.ReceiveActivitiesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(_simpleActivityList);
            var testRunner = new Mock<Runner>(_logger.Object, _directLineClient.Object, _fileHandler.Object);
            var result = await testRunner.Object.RunTranscriptTestAsync(_dlOptions, Path.Combine(_failTestFolder, "simple.json"), false);
            Assert.IsFalse(result);
        }

        [Test]
        public async Task RunTranscriptTestAsyncWithMultipleConversationsPassed()
        {
            _directLineClient.Setup(client => client.ReceiveActivitiesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(_multipleActivityList);
            var testRunner = new Mock<Runner>(_logger.Object, _directLineClient.Object, _fileHandler.Object);
            var result = await testRunner.Object.RunTranscriptTestAsync(_dlOptions, Path.Combine(_passTestFolder, "multiple.json"), false);
            Assert.IsTrue(result);
        }

        [Test]
        public async Task RunTranscriptTestAsyncWithMultipleConversationsFailed()
        {
            _directLineClient.Setup(client => client.ReceiveActivitiesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(_multipleActivityList);
            var testRunner = new Mock<Runner>(_logger.Object, _directLineClient.Object, _fileHandler.Object);
            var result = await testRunner.Object.RunTranscriptTestAsync(_dlOptions, Path.Combine(_failTestFolder, "multiple.json"), false);
            Assert.IsFalse(result);
        }

        [Test]
        public async Task RunTranscriptTestAsyncWithInvalidJson()
        {
            var testRunner = new Mock<Runner>(_logger.Object, _directLineClient.Object, _fileHandler.Object);
            var result = await testRunner.Object.RunTranscriptTestAsync(_dlOptions, Path.Combine(_failTestFolder, "invalid_json.json"), false);
            Assert.IsFalse(result);
        }

        [Test]
        public async Task RunTranscriptTestAsyncWithFolderPassed()
        {
            _fileHandler.Setup(file => file.GetFileAttributes(It.IsAny<string>())).Returns(FileAttributes.Directory);
            _fileHandler.Setup(file => file.GetFilesFromDirectory(It.IsAny<string>(), It.IsAny<string>())).Returns(new List<string>() {
                Path.Combine(_passTestFolder, "simple.json"),
                Path.Combine(_passTestFolder, "multiple.json")
            });
            _directLineClient.Setup(client => client.ReceiveActivitiesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(_simpleAndMultipleActivityList);
            var testRunner = new Mock<Runner>(_logger.Object, _directLineClient.Object, _fileHandler.Object);
            var result = await testRunner.Object.RunTranscriptTestAsync(_dlOptions, _passTestFolder, false);
            Assert.IsTrue(result);
        }

        [Test]
        public async Task RunTranscriptTestAsyncWithFolderFailed()
        {
            _fileHandler.Setup(file => file.GetFileAttributes(It.IsAny<string>())).Returns(FileAttributes.Directory);
            _fileHandler.Setup(file => file.GetFilesFromDirectory(It.IsAny<string>(), It.IsAny<string>())).Returns(new List<string>() {
                Path.Combine(_failTestFolder, "simple.json"),
                Path.Combine(_failTestFolder, "multiple.json")
            });
            _directLineClient.Setup(client => client.ReceiveActivitiesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(_simpleAndMultipleActivityList);
            var testRunner = new Mock<Runner>(_logger.Object, _directLineClient.Object, _fileHandler.Object);
            var result = await testRunner.Object.RunTranscriptTestAsync(_dlOptions, _failTestFolder, false);
            Assert.IsFalse(result);
        }

        [Test]
        public async Task RunScaleTestPassed()
        {
            _directLineClient.Setup(client => client.ReceiveActivitiesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(_simpleActivityList);
            var testRunner = new Mock<Runner>(_logger.Object, _directLineClient.Object, _fileHandler.Object);
            var result = await testRunner.Object.RunTranscriptTestAsync(_dlOptions, Path.Combine(_passTestFolder, "simple.json"), false);
            Assert.IsTrue(result);
        }

        [Test]
        public async Task RunScaleTestFailed()
        {
            _directLineClient.Setup(client => client.ReceiveActivitiesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(_simpleActivityList);
            var testRunner = new Mock<Runner>(_logger.Object, _directLineClient.Object, _fileHandler.Object);
            var result = await testRunner.Object.RunTranscriptTestAsync(_dlOptions, Path.Combine(_failTestFolder, "simple.json"), false);
            Assert.IsFalse(result);
        }

        [Test]
        public async Task RunTranscriptTestAsyncWithDYMPassed()
        {
            _directLineClient.Setup(client => client.ReceiveActivitiesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(_dymActivityList);
            var testRunner = new Mock<Runner>(_logger.Object, _directLineClient.Object, _fileHandler.Object);
            var result = await testRunner.Object.RunTranscriptTestAsync(_dlOptions, Path.Combine(_passTestFolder, "dym.json"), false);
            Assert.IsTrue(result);
        }

        [Test]
        public async Task RunTranscriptTestAsyncWithDYMFailed()
        {
            _directLineClient.Setup(client => client.ReceiveActivitiesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(_dymActivityList);
            var testRunner = new Mock<Runner>(_logger.Object, _directLineClient.Object, _fileHandler.Object);
            var result = await testRunner.Object.RunTranscriptTestAsync(_dlOptions, Path.Combine(_failTestFolder, "dym.json"), false);
            Assert.IsFalse(result);
        }

        [Test]
        public async Task RunTranscriptTestAsyncWithAdaptiveCardPassed()
        {
            _directLineClient.Setup(client => client.ReceiveActivitiesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(_adaptiveCardActivityList);
            var testRunner = new Mock<Runner>(_logger.Object, _directLineClient.Object, _fileHandler.Object);
            var result = await testRunner.Object.RunTranscriptTestAsync(_dlOptions, Path.Combine(_passTestFolder, "adaptive_card.json"), false);
            Assert.IsTrue(result);
        }

        [Test]
        public async Task RunTranscriptTestAsyncWithAdaptiveCardFailed()
        {
            _directLineClient.Setup(client => client.ReceiveActivitiesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(_adaptiveCardActivityList);
            var testRunner = new Mock<Runner>(_logger.Object, _directLineClient.Object, _fileHandler.Object);
            var result = await testRunner.Object.RunTranscriptTestAsync(_dlOptions, Path.Combine(_failTestFolder, "adaptive_card.json"), false);
            Assert.IsFalse(result);
        }

        [Test]
        public void ConvertChatFileToJSONPassed()
        {
            var testRunner = new Mock<Runner>(_logger.Object, _fileHandler.Object);
            var result = testRunner.Object.ConvertChatFileToJSON(Path.Combine(_chatFolder, "basic_transcript.chat"), Path.Combine(_chatFolder, "basic_transcript.json"));
            Assert.IsTrue(result);
        }

        [Test]
        public void ConvertChatFileToJSONWithInvalidFormatFailed()
        {
            string inputFile = "basic_transcript_failed.chat";
            string outputFile = "basic_transcript.json";
            var testRunner = new Mock<Runner>(_logger.Object, _fileHandler.Object);
            var result = testRunner.Object.ConvertChatFileToJSON(Path.Combine(_chatFolder, inputFile), Path.Combine(_chatFolder, outputFile));
            Assert.IsFalse(result);
        }

        [Test]
        public void ConvertChatFileToJSONWithInvalidInputExtensionFailed()
        {
            string inputFile = "basic_transcript_failed.cha_";
            string outputFile = "basic_transcript.json";
            var testRunner = new Mock<Runner>(_logger.Object, _fileHandler.Object);
            var result = testRunner.Object.ConvertChatFileToJSON(Path.Combine(_chatFolder, inputFile), Path.Combine(_chatFolder, outputFile));
            Assert.IsFalse(result);
        }

        [Test]
        public void ConvertChatFileToJSONWithInvalidOutputExtensionFailed()
        {
            string inputFile = "basic_transcript_failed.chat";
            string outputFile = "basic_transcript.jso_";
            var testRunner = new Mock<Runner>(_logger.Object, _fileHandler.Object);
            var result = testRunner.Object.ConvertChatFileToJSON(Path.Combine(_chatFolder, inputFile), Path.Combine(_chatFolder, outputFile));
            Assert.IsFalse(result);
        }

        [Test]
        public void ConvertChatFileToJSONWithInvalidUserMessageFailed()
        {
            string inputFile = "basic_transcript_user.chat";
            string outputFile = "basic_transcript.json";
            var testRunner = new Mock<Runner>(_logger.Object, _fileHandler.Object);
            var result = testRunner.Object.ConvertChatFileToJSON(Path.Combine(_chatFolder, inputFile), Path.Combine(_chatFolder, outputFile));
            Assert.IsFalse(result);
        }

        [Test]
        public void ConvertChatFileToJSONWithInvalidBotMessageFailed()
        {
            string inputFile = "basic_transcript_bot.chat";
            string outputFile = "basic_transcript.json";
            var testRunner = new Mock<Runner>(_logger.Object, _fileHandler.Object);
            var result = testRunner.Object.ConvertChatFileToJSON(Path.Combine(_chatFolder, inputFile), Path.Combine(_chatFolder, outputFile));
            Assert.IsFalse(result);
        }

        [Test]
        public void ConvertChatFileToJSONWithSuggestionsFailed()
        {
            string inputFile = "basic_transcript_sugestion_failed.chat";
            string outputFile = "basic_transcript.json";
            var testRunner = new Mock<Runner>(_logger.Object, _fileHandler.Object);
            var result = testRunner.Object.ConvertChatFileToJSON(Path.Combine(_chatFolder, inputFile), Path.Combine(_chatFolder, outputFile));
            Assert.IsFalse(result);
        }

        [Test]
        public void ConvertChatFileToJSONWithSugestionsPassed()
        {
            string inputFile = "basic_transcript_sugestion.chat";
            string outputFile = "basic_transcript.json";
            var testRunner = new Mock<Runner>(_logger.Object, _fileHandler.Object);
            var result = testRunner.Object.ConvertChatFileToJSON(Path.Combine(_chatFolder, inputFile), Path.Combine(_chatFolder, outputFile));
            Assert.IsTrue(result);
        }
    }
}