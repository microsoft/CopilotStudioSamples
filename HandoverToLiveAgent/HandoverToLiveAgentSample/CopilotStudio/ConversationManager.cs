
using System.Data;
using Microsoft.Agents.Core.Models;

namespace HandoverToLiveAgent.CopilotStudio;

public interface IConversationManager
{
    Task<ConversationMapping?> GetMapping(string id);
    Task<ConversationMapping?> UpsertMappingByCopilotConversationId(IActivity activity, string liveChatConversationId);
    Task RemoveMappingByCopilotConversationId(string id);
}

public class ConversationManager : IConversationManager
{
    private readonly ILogger<ConversationManager> _logger;
    private readonly IConfiguration _config;
    private static readonly Dictionary<string, ConversationMapping> _mappingsByCopilotId = new();
    private static readonly Dictionary<string, ConversationMapping> _mappingsByLiveChatId = new();
    public ConversationManager(IConfiguration config, ILogger<ConversationManager> logger)
    {
        _config = config;
        _logger = logger;
    }

    public async Task<ConversationMapping?> GetMapping(string id)
    {
        _logger.LogInformation("Retrieving mapping for CopilotConversationId={CopilotConversationId}", id);
        if (_mappingsByCopilotId.TryGetValue(id, out var mapping))
        {
            return await Task.FromResult(mapping);
        }
        if (_mappingsByLiveChatId.TryGetValue(id, out mapping))
        {
            return await Task.FromResult(mapping);
        }
        return await Task.FromResult<ConversationMapping?>(null);
    }

    public Task RemoveMappingByCopilotConversationId(string id)
    {
        _logger.LogInformation("Removing mapping for CopilotConversationId={CopilotConversationId}", id);
        _mappingsByCopilotId.Remove(id);
        _mappingsByLiveChatId.Remove(id);
        return Task.CompletedTask;
    }

    public async Task<ConversationMapping?> UpsertMappingByCopilotConversationId(IActivity activity, string liveChatConversationId)
    {
        _logger.LogInformation("Storing mapping: CopilotConversationId={CopilotConversationId}, LiveChatConversationId={LiveChatConversationId}", activity.Conversation?.Id, liveChatConversationId);

        var mapping = await UpsertProactiveConversation(activity.Conversation!.Id, activity);
        mapping!.LiveChatConversationId = liveChatConversationId;
        _mappingsByCopilotId[activity.Conversation!.Id] = mapping;
        _mappingsByLiveChatId[liveChatConversationId] = mapping;

        return mapping;
    }

    private async Task<ConversationMapping?> UpsertProactiveConversation(string copilotConversationId, IActivity activity)
    {
        var mapping = new ConversationMapping
        {
            CopilotConversationId = copilotConversationId
        };

        var userId = activity.From?.Id ?? "unknown-user";
        var serviceUrl = !string.IsNullOrWhiteSpace(activity.ServiceUrl)
                ? activity.ServiceUrl
                : activity.RelatesTo?.ServiceUrl;

        var region = ResolveSmbaRegion(serviceUrl);
        var tenantId = ResolveTenantId();
        
        if (string.IsNullOrWhiteSpace(mapping.UserId) && !string.IsNullOrWhiteSpace(userId))
        {
            mapping.UserId = userId; 
        }
        if (string.IsNullOrWhiteSpace(mapping.ChannelId) && !string.IsNullOrWhiteSpace(activity.ChannelId)) 
        {
            mapping.ChannelId = activity.ChannelId; 
        }
        if (string.IsNullOrWhiteSpace(mapping.BotId) && !string.IsNullOrWhiteSpace(activity.Recipient?.Id))
        {
          mapping.BotId = activity.Recipient!.Id;
        }
        if (string.IsNullOrWhiteSpace(mapping.BotName) && !string.IsNullOrWhiteSpace(activity.Recipient?.Name))
        {
            mapping.BotName = activity.Recipient!.Name;
        }
        if (string.IsNullOrWhiteSpace(mapping.ServiceUrl))
        {
            var su = serviceUrl;
            // If Teams channel is reporting a PVA runtime URL, prefer SMBA for proactive continuation
            if (!string.IsNullOrWhiteSpace(su)
                && string.Equals(activity.ChannelId, "msteams", StringComparison.OrdinalIgnoreCase)
                && su.Contains("pvaruntime", StringComparison.OrdinalIgnoreCase)
                && !su.Contains("smba.trafficmanager.net", StringComparison.OrdinalIgnoreCase))
            {
                var smba = !string.IsNullOrWhiteSpace(tenantId)
                    ? $"https://smba.trafficmanager.net/{region}/{tenantId}/"
                    : "https://smba.trafficmanager.net/teams/";
                _logger.LogInformation("[Proactive][RefCapture] Overriding PVA ServiceUrl to SMBA for Teams channel. From={From} To={To} ConvId={ConversationId}", su, smba, mapping.CopilotConversationId);
                su = smba;
            }
            if (!string.IsNullOrWhiteSpace(su)) mapping.ServiceUrl = su;
        }
        return await Task.FromResult(mapping);
    }

    private string ResolveSmbaRegion(string? url)
    {
        if (string.IsNullOrWhiteSpace(url)) return "amer";
        var u = url.ToLowerInvariant();
        if (u.Contains("-us") || u.Contains(".us-")) return "amer";
        if (u.Contains("-eu") || u.Contains(".eu-") || u.Contains(".uk")) return "emea";
        if (u.Contains("-ap") || u.Contains(".ap-") || u.Contains("asia") || u.Contains("-jp")) return "apac";
        return "amer";
    }

    private string? ResolveTenantId()
    {
        var tid = _config["Connections:default:Settings:TenantId"];
        return string.IsNullOrWhiteSpace(tid) ? null : tid;
    }
}

public class ConversationMapping
{
    public string CopilotConversationId { get; set; } = string.Empty;
    public string LiveChatConversationId { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public string? ChannelId { get; set; }
    public string? ServiceUrl { get; set; }
    public string? BotId { get; set; }
    public string? BotName { get; set; }
}
