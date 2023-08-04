using PVATestFramework.Console.Helpers.Dataverse;
using PVATestFramework.Console.Helpers.FileHandler;
using PVATestFramework.Console.Models.Dataverse;
using Moq;
using Moq.Protected;
using System.Net;

namespace PVATestFramework.Console.Tests
{
    public class DataverseTests
	{
        private DataverseOptions _dvOptions;
        private Mock<IFileHandler> _fileHandler;
        private Mock<HttpMessageHandler> _mockMessageHandler;
        private readonly string _botId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
        private readonly string _tenantId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
        private readonly string _clientId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
        private readonly string _clientSecret = "secret";
        private readonly string _botUri = $"/api/data/v9.2/conversationtranscripts?$top=5&$filter=_bot_conversationtranscriptid_value%20eq%20aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
        private readonly string _environmentUrl = "https://testname.crm.dynamics.com/";
        private readonly string _dvTranscript = Directory.GetCurrentDirectory() + @"\Files\Dataverse\download.json";

        [SetUp]
		public void Setup()
		{
            _dvOptions = new DataverseOptions()
            {
                BotId = _botId,
                TenantId = _tenantId,
                ClientId = _clientId,
                ClientSecret = _clientSecret,
                EnvironmentUrl = _environmentUrl
            };
            
            _fileHandler = new Mock<IFileHandler>();
            _fileHandler.Setup(file => file.CheckFilePath(It.IsAny<string>()));
            _fileHandler.Setup(file => file.WriteToFile(It.IsAny<string>(), It.IsAny<string>()));
            
            _mockMessageHandler = new Mock<HttpMessageHandler>();
            _mockMessageHandler
                .Protected()
                .Setup<Task<HttpResponseMessage>>("SendAsync",
                    ItExpr.Is<HttpRequestMessage>(req => req.RequestUri.Host.Contains("login.microsoftonline.com")),
                    ItExpr.IsAny<CancellationToken>())
                .ReturnsAsync(new HttpResponseMessage
                {
                    StatusCode = HttpStatusCode.OK,
                    Content = new StringContent("{\"access_token\":\"THIS_IS_A_MOCKED_TOKEN\"}")
                });

            _mockMessageHandler
                .Protected()
                .Setup<Task<HttpResponseMessage>>("SendAsync",
                    ItExpr.Is<HttpRequestMessage>(req => req.RequestUri.AbsolutePath.Contains("bots")),
                    ItExpr.IsAny<CancellationToken>())
                .ReturnsAsync(new HttpResponseMessage
                {
                    StatusCode = HttpStatusCode.OK,
                    Content = new StringContent("{\"@odata.context\":\"https://testname.crm.dynamics.com/api/data/v9.2/$metadata#bots\"}")
                });

            _mockMessageHandler
                .Protected()
                .Setup<Task<HttpResponseMessage>>("SendAsync",
                    ItExpr.Is<HttpRequestMessage>(req => req.RequestUri.AbsolutePath.Contains("conversationtranscripts")),
                    ItExpr.IsAny<CancellationToken>())
                .ReturnsAsync(new HttpResponseMessage
                {
                    StatusCode = HttpStatusCode.OK,
                    Content = new StringContent(File.ReadAllText(_dvTranscript))
                });
        }

		[Test]
		public async Task GetJsonFromDataverseAsyncPassed()
        {
            var httpClient = new HttpClient(_mockMessageHandler.Object);          
            var dataverseConnector = new Mock<DataverseConnector>(_dvOptions, httpClient, _fileHandler.Object);
            var result = await dataverseConnector.Object.GetJsonFromDataverseAsync(string.Concat(_environmentUrl, _botUri), false, "transcript.json");
			Assert.IsTrue(result);
		}

        [Test]
        public async Task GetJsonFromDataverseAsyncInvalidToken()
        {
            _mockMessageHandler
                .Protected()
                .Setup<Task<HttpResponseMessage>>("SendAsync",
                    ItExpr.Is<HttpRequestMessage>(req => req.RequestUri.Host.Contains("login.microsoftonline.com")),
                    ItExpr.IsAny<CancellationToken>())
                .ReturnsAsync(new HttpResponseMessage
                {
                    StatusCode = HttpStatusCode.OK,
                    Content = new StringContent("{\"error_description\":\"token error\"}")
                });

            var httpClient = new HttpClient(_mockMessageHandler.Object);
            var dataverseConnector = new Mock<DataverseConnector>(_dvOptions, httpClient, _fileHandler.Object);
            var result = await dataverseConnector.Object.GetJsonFromDataverseAsync(string.Concat(_environmentUrl, _botUri), false, "transcript.json");
            Assert.IsFalse(result);
        }

        [Test]
        public async Task GetJsonFromDataverseAsyncInvalidClientId()
        {
            _mockMessageHandler
                .Protected()
                .Setup<Task<HttpResponseMessage>>("SendAsync",
                    ItExpr.Is<HttpRequestMessage>(req => req.RequestUri.AbsolutePath.Contains("bots")),
                    ItExpr.IsAny<CancellationToken>())
                .ReturnsAsync(new HttpResponseMessage
                {
                    StatusCode = HttpStatusCode.Forbidden
                });

            var httpClient = new HttpClient(_mockMessageHandler.Object);
            var dataverseConnector = new Mock<DataverseConnector>(_dvOptions, httpClient, _fileHandler.Object);
            var result = await dataverseConnector.Object.GetJsonFromDataverseAsync(string.Concat(_environmentUrl, _botUri), false, "transcript.json");
            Assert.IsFalse(result);
        }

        [Test]
        public async Task GetJsonFromDataverseAsyncInvalidBotId()
        {
            _mockMessageHandler
                .Protected()
                .Setup<Task<HttpResponseMessage>>("SendAsync",
                    ItExpr.Is<HttpRequestMessage>(req => req.RequestUri.AbsolutePath.Contains("bots")),
                    ItExpr.IsAny<CancellationToken>())
                .ReturnsAsync(new HttpResponseMessage
                {
                    StatusCode = HttpStatusCode.NotFound
                });

            var httpClient = new HttpClient(_mockMessageHandler.Object);
            var dataverseConnector = new Mock<DataverseConnector>(_dvOptions, httpClient, _fileHandler.Object);
            var result = await dataverseConnector.Object.GetJsonFromDataverseAsync(string.Concat(_environmentUrl, _botUri), false, "transcript.json");
            Assert.IsFalse(result);
        }

        [Test]
        public async Task GetJsonFromDataverseAsyncInvalidFileExtension()
        {
            var httpClient = new HttpClient(_mockMessageHandler.Object);
            var dataverseConnector = new Mock<DataverseConnector>(_dvOptions, httpClient, _fileHandler.Object);
            var result = await dataverseConnector.Object.GetJsonFromDataverseAsync(string.Concat(_environmentUrl, _botUri), false, "transcript");
            Assert.IsFalse(result);
        }
    }
}