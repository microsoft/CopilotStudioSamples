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
    private readonly IConversationManager _conversationManager;

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
        

        if (turnContext.Activity.Name == "endOfConversation")
        {
            _logger.LogInformation("EndOfConversation event received. Performing any necessary cleanup.");
            await liveChatService.SendMessageAsync(message: "The conversation ended by user.", sender: "System");
            //sending EndOfConversation activity back to Copilot Studio
            await turnContext.SendActivityAsync(new Activity
            {
                Type = ActivityTypes.EndOfConversation,
                Name = "endOfConversation",
                Text = string.Empty,
                Code = EndOfConversationCodes.CompletedSuccessfully
            }, ct);
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
        var conversationId = turnContext.Activity.Conversation?.Id ?? "unknown-conversatioin-id";
        var userName = turnContext.Activity.From?.Name ?? "unknown-user";
        var message = turnContext.Activity.Text ?? string.Empty;

        using var scope = _scopeFactory.CreateScope();
        var liveChatService = scope.ServiceProvider.GetRequiredService<ILiveChatService>();
        var conversationManager = scope.ServiceProvider.GetRequiredService<IConversationManager>();


        if (turnContext.Activity.ChannelId != "msteams")
        {
            _logger.LogError("Unsupported channel ID for proactive messages: {ChannelId}", turnContext.Activity.ChannelId);
            return;
        }

        /// Proactive message setup
        await conversationManager.UpsertProactiveConversation(conversationId, turnContext.Activity);
        var testId = await conversationManager.TEST_GetCConversationId(conversationId);

        //var mapping = await conversationManager.GetMappingByCopilotConversationId(conversationId);

        if (IConversationManager.Mapping1 == null)
        {

            _logger.LogError("NO MAPPING FOUND!");
            throw new Exception("No mapping found!");
        }

        // if (mapping == null)
        // {
        //     _logger.LogWarning("No mapping found for Copilot conversation ID: {ConversationId}", conversationId);
        //     //todo we should support userId from both sides so we can support more than as single live conversation
        //     var mapping = conversationManager.CreateMappingForConversationId(conversationId, testId);

        //     conversationManager.UpdateMapping(mapping);
        // }
        ///---end proactive message setup

        await liveChatService.SendMessageAsync(message, userName);
        _logger.LogInformation("Message sent to live chat");
    }
}