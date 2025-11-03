

using System.Text;
using System.Text.Json;

namespace HandoverToLiveAgent.LiveChat;

public interface ILiveChatService
{
    Task<Guid?> StartConversationAsync();
    Task<bool> SendMessageAsync(string message, string sender);
}

public class LiveChatService : ILiveChatService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<LiveChatService> _logger;

    public LiveChatService(HttpClient httpClient, IConfiguration configuration, ILogger<LiveChatService> logger)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<Guid?> StartConversationAsync()
    {
        try
        {
            var baseUrl = _configuration["LiveChatSettings:BaseUrl"];
            if (string.IsNullOrEmpty(baseUrl))
            {
                _logger.LogWarning("BaseUrl is not configured in LiveChatSettings");
                return null;
            }

            var conversationUrl = $"{baseUrl}/api/chat/conversation";
            _logger.LogInformation("Starting a new live chat conversation at {Url}", conversationUrl);

            var response = await _httpClient.PostAsync(conversationUrl, null);

            if (response.IsSuccessStatusCode)
            {
                var responseContent = await response.Content.ReadAsStringAsync();
                var result = JsonSerializer.Deserialize<ConversationResponse>(responseContent, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });

                _logger.LogInformation("Conversation started successfully with session ID: {SessionId}", result?.SessionId);
                return result?.SessionId;
            }
            else
            {
                _logger.LogWarning("Failed to start conversation. Status: {StatusCode}", response.StatusCode);
                return null;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error starting conversation");
            return null;
        }
    }

    public async Task<bool> SendMessageAsync(string message, string sender)
    {
        try
        {
            var baseUrl = _configuration["LiveChatSettings:BaseUrl"];
            if (string.IsNullOrEmpty(baseUrl))
            {
                _logger.LogWarning("BaseUrl is not configured in LiveChatSettings");
                return false;
            }

            var sendMessageUrl = $"{baseUrl}/api/chat/receive";
            _logger.LogInformation("Sending message to {Url}: {Message}", sendMessageUrl, message);

            var payload = new
            {
                message,
                sender
            };

            var json = JsonSerializer.Serialize(payload);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            //Sending message to the Live Chat endpoint. The response message response will 
            //come back over a webhook configured in the Live Chat system.
            var response = await _httpClient.PostAsync(sendMessageUrl, content);

            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("Message sent successfully");
                return true;
            }
            else
            {
                _logger.LogWarning("Failed to send message. Status: {StatusCode}", response.StatusCode);
                return false;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending message");
            return false;
        }
    }
}

public class ConversationResponse
{
    public Guid SessionId { get; set; }
    public string Message { get; set; } = string.Empty;
}