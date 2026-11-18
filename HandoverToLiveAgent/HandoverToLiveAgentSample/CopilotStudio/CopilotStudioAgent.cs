using Microsoft.Agents.Builder;
using Microsoft.Agents.Builder.App;
using Microsoft.Agents.Builder.State;
using Microsoft.Agents.Core.Models;
using HandoverToLiveAgent.LiveChat;

namespace HandoverToLiveAgent.CopilotStudio;

// NOTE: Avoid injecting scoped services directly because the Agents SDK registers the agent as a singleton.
// We instead create a scope per turn to resolve required scoped dependencies.
public class CopilotStudioAgent : AgentApplication
{
    private readonly ILogger<CopilotStudioAgent> _logger;
    private readonly IServiceScopeFactory _scopeFactory;

    public CopilotStudioAgent(AgentApplicationOptions options, ILogger<CopilotStudioAgent> logger, IServiceScopeFactory scopeFactory) : base(options)
    {
        _logger = logger;
        _scopeFactory = scopeFactory;


        OnActivity(ActivityTypes.Message, OnMessageAsync);
        OnActivity(ActivityTypes.Event, OnEventAsync);
    }

    private async Task OnEventAsync(ITurnContext turnContext, ITurnState turnState, CancellationToken ct)
    {
        _logger.LogInformation("Copilot event received: {EventName}", turnContext.Activity.Name);
        using var scope = _scopeFactory.CreateScope();
        var liveChatService = scope.ServiceProvider.GetRequiredService<ILiveChatService>();
        var conversationManager = scope.ServiceProvider.GetRequiredService<IConversationManager>();

        if (turnContext.Activity.Name == "startConversation")
        {
            _logger.LogInformation("StartConversation event received. Initiating live chat conversation.");
            var liveChatConversationId = await liveChatService.StartConversationAsync();
            if (string.IsNullOrEmpty(liveChatConversationId))
            {
                _logger.LogError("Failed to start live chat conversation.");
                throw new Exception("Failed to start live chat conversation.");
            }
            _logger.LogInformation("Live chat conversation started with ID: {LiveChatConversationId}", liveChatConversationId);

            // update mapping in ConversationManager with current activity state
            await conversationManager.UpsertMappingByCopilotConversationId(turnContext.Activity, liveChatConversationId);

            //sending EndConversation activity back to Copilot Studio. Every activity must have a response to allow topical flow to complete.
            await turnContext.SendActivityAsync(new Activity
            {
                Type = ActivityTypes.EndOfConversation,
                Name = "startConversation",
                Text = string.Empty,
                Code = EndOfConversationCodes.CompletedSuccessfully,
                Value = new
                {
                    LiveChatConversationId = liveChatConversationId
                }
            }, ct);
        }
        else if (turnContext.Activity.Name == "endConversation")
        {
            _logger.LogInformation("EndOfConversation event received. Performing any necessary cleanup.");

            //sending EndOfConversation activity back to Copilot Studio. Every activity must have a response to allow topical flow to complete.
            await turnContext.SendActivityAsync(new Activity
            {
                Type = ActivityTypes.EndOfConversation,
                Name = "endConversation",
                Text = string.Empty,
                Code = EndOfConversationCodes.CompletedSuccessfully
            }, ct);
            
            var mapping = await conversationManager.GetMapping(turnContext.Activity.Conversation!.Id);
            if (mapping == null)
            {
                _logger.LogWarning("No mapping found for Copilot conversation ID: {ConversationId}", turnContext.Activity.Conversation?.Id);
                return;
            }
            await liveChatService.SendMessageAsync(mapping.LiveChatConversationId, message: "The conversation ended by user.", sender: "System");
            await liveChatService.EndConversationAsync(mapping.LiveChatConversationId);
            await conversationManager.RemoveMappingByCopilotConversationId(turnContext.Activity.Conversation!.Id);
            await turnState.Conversation.DeleteStateAsync(turnContext, ct);
            _logger.LogInformation("Conversation ended and state cleared.");
        }
        else
        {
            _logger.LogError("Unhandled event type: {EventName}", turnContext.Activity.Name);
            throw new NotImplementedException($"Event '{turnContext.Activity.Name}' not implemented.");
        }
        await Task.CompletedTask;
    }

    private async Task OnMessageAsync(ITurnContext turnContext, ITurnState turnState, CancellationToken ct)
    {
        _logger.LogInformation("Copilot message received: {Message}", turnContext.Activity.Text);
        var userName = turnContext.Activity.From?.Name ?? "unknown-user";
        var message = turnContext.Activity.Text ?? string.Empty;

        using var scope = _scopeFactory.CreateScope();
        var liveChatService = scope.ServiceProvider.GetRequiredService<ILiveChatService>();
        var conversationManager = scope.ServiceProvider.GetRequiredService<IConversationManager>();


        if (turnContext.Activity.ChannelId != "msteams")
        {
            _logger.LogError("Unsupported channel ID for proactive messages: {ChannelId}", turnContext.Activity.ChannelId);
            throw new NotImplementedException($"Channel '{turnContext.Activity.ChannelId}' not supported for proactive messages.");
        }

        var mapping = await conversationManager.GetMapping(turnContext.Activity.Conversation!.Id);
        if (mapping == null)
        {
            _logger.LogError("No mapping found for Copilot conversation ID: {ConversationId}", turnContext.Activity.Conversation?.Id);
            throw new Exception("No mapping found for conversation. Make sure a live chat conversation has been started.");
        }
        mapping = await conversationManager.UpsertMappingByCopilotConversationId(turnContext.Activity, mapping.LiveChatConversationId);

        await liveChatService.SendMessageAsync(mapping!.LiveChatConversationId, message, userName);
        _logger.LogInformation("Message sent to live chat");
    }
}