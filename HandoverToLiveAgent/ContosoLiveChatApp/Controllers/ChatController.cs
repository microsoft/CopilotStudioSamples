using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("api/[controller]")]
public class ChatController : ControllerBase
{
    private readonly ChatService _chatService;
    private readonly WebhookService _webhookService;
    private readonly ILogger<ChatController> _logger;

    public ChatController(ChatService chatService, WebhookService webhookService, ILogger<ChatController> logger)
    {
        _chatService = chatService;
        _webhookService = webhookService;
        _logger = logger;
    }

    // GET: api/chat/messages - Get all chat messages
    [HttpGet("messages")]
    public ActionResult<IEnumerable<ChatMessage>> GetMessages()
    {
        var messages = _chatService.GetAllMessages();
        return Ok(messages);
    }

    // POST: api/chat/send - Send a message (from user to webhook)
    [HttpPost("send")]
    public async Task<ActionResult> SendMessage([FromBody] SendMessageRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Text))
        {
            return BadRequest(new { error = "Message text cannot be empty" });
        }

        var message = new ChatMessage
        {
            Text = request.Text,
            Sender = "Contoso Support",
            Direction = MessageDirection.Outgoing,
            Timestamp = DateTime.UtcNow
        };

        // Add to chat history
        _chatService.AddMessage(message);

        // Send to webhook
        var success = await _webhookService.SendMessageAsync(message);

        if (success)
        {
            return Ok(new { message = "Message sent successfully", messageId = message.Id });
        }
        else
        {
            return StatusCode(500, new { error = "Failed to send message to webhook" });
        }
    }

    // POST: api/chat/receive - Receive a message (from remote party)
    [HttpPost("receive")]
    public ActionResult ReceiveMessage([FromBody] ReceiveMessageRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Text))
        {
            return BadRequest(new { error = "Message text cannot be empty" });
        }

        var message = new ChatMessage
        {
            Text = request.Text,
            Sender = request.Sender ?? "Remote",
            Direction = MessageDirection.Incoming,
            Timestamp = DateTime.UtcNow
        };

        _chatService.AddMessage(message);
        _logger.LogInformation("Received message from {Sender}: {Text}", message.Sender, message.Text);

        return Ok(new { message = "Message received successfully", messageId = message.Id });
    }
}

public class SendMessageRequest
{
    public string Text { get; set; } = string.Empty;
}

public class ReceiveMessageRequest
{
    public string Text { get; set; } = string.Empty;
    public string? Sender { get; set; }
}
