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

            //contoso conv id?
            var contosoUserName = request.Sender;
            var contosoMessage = request.Text;
            _logger.LogInformation("Received message from Live Chat. Sender: {Sender}, Text: {Text}", contosoUserName, contosoMessage);

            // Find corresponding Copilot Studio conversation
            //var mapping = await _conversationManager.GetMappingByZendeskConversationId(zendeskConversationId);
            var testid = _conversationManager.TEST_GetCConversationId(request.Id); //get contoso sessions id?
            await _proactiveMessenger.SendTextAsync(IConversationManager.Mapping1!.ProactiveConversation, contosoMessage, contosoUserName);
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
    public string Id { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
    public string Sender { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
}
