using Microsoft.AspNetCore.Mvc;

namespace HandoverToLiveAgent.LiveChat;

[ApiController]
[Route("api/[controller]")]
public class LiveChatWebhookController : ControllerBase
{
    private readonly ILogger<LiveChatWebhookController> _logger;

    public LiveChatWebhookController(ILogger<LiveChatWebhookController> logger)
    {
        _logger = logger;
    }

    // POST: api/messages
    // Used to receive webhook messages from the Live Chat system
    [HttpPost]
    public ActionResult ReceiveMessage([FromBody] MessageRequest request)
    {
        _logger.LogDebug("Full message details: {@Request}", request);

        throw new NotImplementedException("Processing incoming live chat messages is not implemented yet.");

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
