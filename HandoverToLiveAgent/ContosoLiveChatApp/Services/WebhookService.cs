using System.Text;
using System.Text.Json;

public class WebhookService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<WebhookService> _logger;

    public WebhookService(HttpClient httpClient, IConfiguration configuration, ILogger<WebhookService> logger)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<bool> SendMessageAsync(ChatMessage message)
    {
        try
        {
            var webhookUrl = _configuration["WebhookSettings:OutgoingWebhookUrl"];
            
            if (string.IsNullOrEmpty(webhookUrl))
            {
                _logger.LogWarning("Webhook URL is not configured");
                return false;
            }

            var json = JsonSerializer.Serialize(message);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await _httpClient.PostAsync(webhookUrl, content);
            
            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("Message sent successfully to webhook: {MessageId}", message.Id);
                return true;
            }
            else
            {
                _logger.LogWarning("Failed to send message to webhook. Status: {StatusCode}", response.StatusCode);
                return false;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending message to webhook");
            return false;
        }
    }
}
