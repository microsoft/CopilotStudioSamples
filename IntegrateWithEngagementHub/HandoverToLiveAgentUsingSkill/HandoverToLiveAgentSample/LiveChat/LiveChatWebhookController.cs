using Microsoft.AspNetCore.Mvc;
using HandoverToLiveAgent.CopilotStudio;

namespace HandoverToLiveAgent.LiveChat;

[ApiController]
[Route("api/livechat")]
public class LiveChatWebhookController : ControllerBase
{
    private readonly ILogger<LiveChatWebhookController> _logger;
    private readonly IConversationManager _conversationManager;
    private readonly IProactiveMessenger _proactiveMessenger;

    public LiveChatWebhookController(ILogger<LiveChatWebhookController> logger, IConversationManager conversationManager, IProactiveMessenger proactiveMessenger)
    {
        _logger = logger;
        _conversationManager = conversationManager;
        _proactiveMessenger = proactiveMessenger;
    }

    // POST: api/livechat/messages
    // Used to receive webhook messages from the Live Chat system
    [HttpPost("messages")]
    public async Task<ActionResult> ReceiveMessageAsync([FromBody] MessageRequest request)
    {
        _logger.LogDebug("Full message details: {@Request}", request);
        try
        {

            var contosoUserName = request.Sender;
            var contosoMessage = request.Message;
            var liveChatConversationId = request.ConversationId;
            _logger.LogInformation("Received message from Live Chat. Sender: {Sender}, Text: {Text}", contosoUserName, contosoMessage);

            var mapping = await _conversationManager.GetMapping(liveChatConversationId);
            if (mapping == null)
            {
                _logger.LogError("No mapping found for Live Chat conversation ID: {LiveChatConversationId}", liveChatConversationId);
                throw new Exception("No mapping found for conversation. Make sure a Copilot Studio conversation has been started.");
            }
            // proactive messages are only supported in MS Teams channel
            await _proactiveMessenger.SendTextAsync(mapping, contosoMessage, contosoUserName);
            _logger.LogInformation("Proactive message sent to Copilot Studio for user: {UserName}", contosoUserName);

        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing live chat message");
            return StatusCode(500, ex.Message);
        }

        return Ok(new
        {
            message = "Message received successfully",
            timestamp = DateTime.UtcNow,
            receivedFrom = request.Sender
        });
    }
}

public class MessageRequest
{
    public string ConversationId { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string Sender { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
}
