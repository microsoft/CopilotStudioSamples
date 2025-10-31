using System.Collections.Concurrent;

public class ChatService
{
    private readonly ConcurrentBag<ChatMessage> _messages = new();

    public void AddMessage(ChatMessage message)
    {
        _messages.Add(message);
    }

    public IEnumerable<ChatMessage> GetAllMessages()
    {
        return _messages.OrderBy(m => m.Timestamp);
    }

    public ChatMessage? GetMessageById(string id)
    {
        return _messages.FirstOrDefault(m => m.Id == id);
    }
}
