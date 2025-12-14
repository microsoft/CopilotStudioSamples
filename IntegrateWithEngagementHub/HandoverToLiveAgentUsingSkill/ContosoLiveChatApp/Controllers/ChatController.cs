using System.Runtime.ExceptionServices;
using System.Security;
using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("api/[controller]")]
public class ChatController : ControllerBase
{
    private readonly ChatStorageService _chatStorage;
    private readonly WebhookService _webhookService;
    private readonly ILogger<ChatController> _logger;

    public ChatController(ChatStorageService chatStorage, WebhookService webhookService, ILogger<ChatController> logger)
    {
        _chatStorage = chatStorage;
        _webhookService = webhookService;
        _logger = logger;
    }

    // GET: api/chat/messages - Get all chat messages
    [HttpGet("messages")]
    public ActionResult<IEnumerable<ChatMessage>> GetMessages(string? conversationId = null)
    {
        var messages = _chatStorage.GetAllMessages(conversationId);
        return Ok(messages);
    }

    // POST: api/chat/start - Start a new conversation and return conversation ID
    [HttpPost("start")]
    public ActionResult StartConversation()
    {
        try
        {
            var conversationId = Guid.NewGuid().ToString()[..5];
            _logger.LogInformation("Started new conversation with ID: {ConversationId}", conversationId);

            _chatStorage.StartConversation(conversationId);
    
            return Ok(new { conversationId });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error starting conversation");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    // POST: api/chat/end - End a conversation
    [HttpPost("end")]
    public ActionResult EndConversation([FromBody] MessageRequest request)
    {
        try
        {
            _logger.LogInformation("Ending conversation with ID: {ConversationId}", request.ConversationId);
            _chatStorage.EndConversation(request.ConversationId);
            return Ok(new { message = "Conversation ended successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error ending conversation");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    // POST: api/chat/send - Send a message (from Live Chat to Copilot Studio webhook)
    [HttpPost("send")]
    public async Task<ActionResult> SendMessage([FromBody] MessageRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Message))
        {
            return BadRequest(new { error = "Message text cannot be empty" });
        }

        var message = new ChatMessage
        {
            ConversationId = request.ConversationId,
            Message = request.Message,
            Sender = "Contoso Support",
            Timestamp = DateTime.UtcNow
        };

        // Send to webhook first
        var (statusCode, errorMessage) = await _webhookService.SendMessageAsync(message);

        if (statusCode.HasValue && statusCode >= 200 && statusCode < 300)
        {
            // Only add to chat history if webhook send was successful
            _chatStorage.AddMessage(message.ConversationId, message);
            return Ok(new { message = "Message sent successfully", messageId = message.Id, timestamp = message.Timestamp, sender = message.Sender, conversationId = message.ConversationId });
        }
        else
        {
            return StatusCode(statusCode ?? 500, new { error = errorMessage });
        }
    }

    // POST: api/chat/receive - Receive a message (from  Copilot Studio )
    [HttpPost("receive")]
    public ActionResult ReceiveMessage([FromBody] MessageRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Message))
        {
            return BadRequest(new { error = "Message text cannot be empty" });
        }

        var message = new ChatMessage
        {
            ConversationId = request.ConversationId,
            Message = request.Message,
            Sender = request.Sender ?? "Remote",
            Timestamp = DateTime.UtcNow
        };

        _chatStorage.AddMessage(message.ConversationId, message);
        _logger.LogInformation("Received message from {Sender}: {Text}", message.Sender, message.Message);

        return Ok(new { message = "Message received successfully", messageId = message.Id });
    }
}

public class MessageRequest
{
    public string ConversationId { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string? Sender { get; set; }
}
