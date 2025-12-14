using System.Collections.Concurrent;

public class ChatStorageService
{
    private readonly ConcurrentDictionary<string, IList<ChatMessage>> _activeConversations = new();
    private readonly ILogger<ChatStorageService> _logger;

    public ChatStorageService(ILogger<ChatStorageService> logger)
    {
        _logger = logger;
    }

    public void AddMessage(string conversationId, ChatMessage message)
    {
        _logger.LogInformation("Adding message to conversation ID: {ConversationId}", conversationId);
        if (_activeConversations.TryGetValue(conversationId, out var messages))
        {
            messages.Add(message);
        }
        else
        {
            _logger.LogWarning("No active conversation found with ID: {ConversationId}", conversationId);
        }
    }

    public void StartConversation(string conversationId)
    {
        _activeConversations[conversationId] = new List<ChatMessage>();
        _logger.LogInformation("Started conversation with ID: {ConversationId}", conversationId);
    }

    public void EndConversation(string conversationId)
    {
        _activeConversations.TryRemove(conversationId, out _);
        _logger.LogInformation("Ended conversation with ID: {ConversationId}", conversationId);
    }

    public IEnumerable<ChatMessage> GetAllMessages(string? conversationId)
    {
        if (string.IsNullOrEmpty(conversationId))
        {
            return _activeConversations.Values
                .SelectMany(messages => messages)
                .OrderBy(m => m.Timestamp);
        }
        
        _logger.LogInformation("Retrieving messages for conversation ID: {ConversationId}", conversationId);
        if (_activeConversations.TryGetValue(conversationId, out var messages))
        {
            return messages.OrderBy(m => m.Timestamp);
        }
        else
        {
            _logger.LogWarning("No active conversation found with ID: {ConversationId}", conversationId);
            return Enumerable.Empty<ChatMessage>();
        }
    }
}
