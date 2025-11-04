
using System.Data;
using Microsoft.Agents.Core.Models;

namespace HandoverToLiveAgent.CopilotStudio;

public class ProactiveConversation
{
    public string ConversationId { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public string? ChannelId { get; set; }
    public string? ServiceUrl { get; set; }
    public string? BotId { get; set; }
    public string? BotName { get; set; }
}

public class CopilotStudioConversationMapping
{
    public string ConversationId { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public ProactiveConversation ProactiveConversation { get; set; } = new();
}


public interface IConversationManager
{
    Task UpsertProactiveConversation(string copilotConversationId, IActivity activity);
    void UpdateServiceUrlMapping(CopilotStudioConversationMapping mapping, IActivity activity);
    Task<string?> TEST_GetCConversationId(string liveChatConversationId);
    public static CopilotStudioConversationMapping? Mapping1 { get; set; } = null;
}

public class ConversationManager : IConversationManager
{
    private readonly ILogger<ConversationManager> _logger;
    private readonly IConfiguration _config;
    public ConversationManager(IConfiguration config, ILogger<ConversationManager> logger)
    {
        _config = config;
        _logger = logger;
    }

    public Task<string?> TEST_GetCConversationId(string liveChatConversationId){
        return Task.FromResult<string?>(Guid.Empty.ToString());
    }

    public Task UpsertProactiveConversation(string copilotConversationId, IActivity activity)
    {
        var cref = new ProactiveConversation
        {
            ConversationId = copilotConversationId
        };

        var userId = activity.From?.Id ?? "unknown-user";
        var serviceUrl = !string.IsNullOrWhiteSpace(activity.ServiceUrl)
                ? activity.ServiceUrl
                : activity.RelatesTo?.ServiceUrl;

        var region = ResolveSmbaRegion(serviceUrl);
        var tenantId = ResolveTenantId();
        if (string.IsNullOrWhiteSpace(cref.UserId) && !string.IsNullOrWhiteSpace(userId)) cref.UserId = userId;
        if (string.IsNullOrWhiteSpace(cref.ChannelId) && !string.IsNullOrWhiteSpace(activity.ChannelId)) cref.ChannelId = activity.ChannelId;
        if (string.IsNullOrWhiteSpace(cref.ServiceUrl))
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
                _logger.LogInformation("[Proactive][RefCapture] Overriding PVA ServiceUrl to SMBA for Teams channel. From={From} To={To} ConvId={ConversationId}", su, smba, cref.ConversationId);
                su = smba;
            }
            if (!string.IsNullOrWhiteSpace(su)) cref.ServiceUrl = su;
        }
        if (string.IsNullOrWhiteSpace(cref.BotId) && !string.IsNullOrWhiteSpace(activity.Recipient?.Id)) cref.BotId = activity.Recipient!.Id;
            if (string.IsNullOrWhiteSpace(cref.BotName) && !string.IsNullOrWhiteSpace(activity.Recipient?.Name)) cref.BotName = activity.Recipient!.Name;

        //_cache.Set(key, cref, TimeSpan.FromHours(24));
        //TODO
        if(IConversationManager.Mapping1 == null)
        {
            IConversationManager.Mapping1 = new CopilotStudioConversationMapping
            {
                ConversationId = copilotConversationId,
                UserId = userId,
                ProactiveConversation = cref
            };
        }
        else
        {
            IConversationManager.Mapping1.ConversationId = copilotConversationId;
            IConversationManager.Mapping1.UserId = userId;
            IConversationManager.Mapping1.ProactiveConversation = cref;
        }
        //
        return Task.CompletedTask;
    }

    public void UpdateServiceUrlMapping(CopilotStudioConversationMapping mapping, IActivity activity)
    {
        if (mapping?.ProactiveConversation is { } cref)
        {
            var region = ResolveSmbaRegion(activity.ServiceUrl);
            var tenantId = ResolveTenantId();
            bool changed = false;
            if (string.IsNullOrEmpty(cref.ChannelId) && activity.ChannelId is { } channelId)
            {
                cref.ChannelId = channelId;
                changed = true;
            }
            if (string.IsNullOrEmpty(cref.ServiceUrl))
            {
                string? su = null;
                // 1. Primary: Activity.ServiceUrl
                if (!string.IsNullOrWhiteSpace(activity.ServiceUrl))
                {
                    su = activity.ServiceUrl;
                    _logger.LogDebug("[Proactive][RefCapture] Captured ServiceUrl from Activity.ServiceUrl={ServiceUrl} ConvId={ConversationId}", su, cref.ConversationId);
                }
                // 2. Secondary: RelatesTo.ServiceUrl (some adapters populate here on skill replies)
                else if (!string.IsNullOrWhiteSpace(activity.RelatesTo?.ServiceUrl))
                {
                    su = activity.RelatesTo.ServiceUrl;
                    _logger.LogInformation("[Proactive][RefCapture] Using RelatesTo.ServiceUrl={ServiceUrl} ConvId={ConversationId}", su, cref.ConversationId);
                }
                // Teams-specific: if PVA runtime URL appears for Teams channel, prefer SMBA
                if (!string.IsNullOrWhiteSpace(su)
                    && string.Equals(activity.ChannelId, "msteams", StringComparison.OrdinalIgnoreCase)
                    && su.Contains("pvaruntime", StringComparison.OrdinalIgnoreCase)
                    && !su.Contains("smba.trafficmanager.net", StringComparison.OrdinalIgnoreCase))
                {
                    var smba = !string.IsNullOrWhiteSpace(tenantId)
                        ? $"https://smba.trafficmanager.net/{region}/{tenantId}/"
                        : "https://smba.trafficmanager.net/teams/";
                    _logger.LogInformation("[Proactive][RefCapture] Overriding PVA ServiceUrl to SMBA for Teams channel. From={From} To={To} ConvId={ConversationId}", su, smba, cref.ConversationId);
                    su = smba;
                }
                // 3. Fallback: Static Teams global endpoint (only if still unknown)
                if (string.IsNullOrWhiteSpace(su))
                {
                    su = "https://smba.trafficmanager.net/teams/"; // safe generic; real continuation normally needs exact host instance
                    _logger.LogInformation("[Proactive][RefCapture] ServiceUrl absent; applying generic fallback {ServiceUrl} ConvId={ConversationId}", su, cref.ConversationId);
                }
                cref.ServiceUrl = su;
                changed = true;
            }
            if (string.IsNullOrEmpty(cref.BotId) && activity.Recipient?.Id is { } bid)
            {
                cref.BotId = bid;
                changed = true;
            }
            if (string.IsNullOrEmpty(cref.BotName) && activity.Recipient?.Name is { } bname)
            {
                cref.BotName = bname;
                changed = true;
            }
            //TODO
            if (changed)
            {
                if (IConversationManager.Mapping1 != null)
                {
                    IConversationManager.Mapping1.ProactiveConversation = cref;
                    //await UpdateMapping(mapping);
                }
                else
                {
                    IConversationManager.Mapping1 = mapping;
                }
            }
        }
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