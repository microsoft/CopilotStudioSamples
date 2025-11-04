using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.Agents.Builder;
using Microsoft.Agents.Core.Models;
using ChannelAccount = Microsoft.Agents.Core.Models.ChannelAccount;
using ConversationAccount = Microsoft.Agents.Core.Models.ConversationAccount;


namespace HandoverToLiveAgent.CopilotStudio;

public interface IProactiveMessenger
{
    Task SendTextAsync(ProactiveConversation reference, string message, string? userName = null, CancellationToken ct = default);
}

public class MsTeamsProactiveMessage : IProactiveMessenger
{
    private readonly ILogger<MsTeamsProactiveMessage> _logger;
    private readonly IChannelAdapter? _channelAdapter;
    private readonly IConfiguration? _configuration;

    public MsTeamsProactiveMessage(ILogger<MsTeamsProactiveMessage> logger,
        IServiceProvider serviceProvider)
    {
        _logger = logger;
        _channelAdapter = serviceProvider.GetService(typeof(IChannelAdapter)) as IChannelAdapter;
        _configuration = serviceProvider.GetService(typeof(IConfiguration)) as IConfiguration;
    }

    public async Task SendTextAsync(ProactiveConversation reference, string message, string? userName = null, CancellationToken ct = default)
    {
        if (_channelAdapter == null)
        {
            _logger.LogWarning("Channel adapter is not available. Cannot send proactive message.");
            return;
        }
        
        var effectiveServiceUrl = reference.ServiceUrl!;
        var channelId = reference.ChannelId;

        var appId = ResolveAppIdForServiceUrl(effectiveServiceUrl);
        if (appId == null)
        {
            _logger.LogWarning("Could not resolve App ID for service URL: {ServiceUrl}", effectiveServiceUrl);
            return;
        }
       
        if (!string.Equals(channelId, "msteams", StringComparison.OrdinalIgnoreCase)
            && effectiveServiceUrl.Contains("smba.trafficmanager.net", StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning("Non-Teams channel with SMBA ServiceUrl. Using as-is. Conv={ConversationId} Ch={ChannelId} ServiceUrl={ServiceUrl}", reference.ConversationId, channelId, effectiveServiceUrl);
        }
        _logger.LogInformation("Sending proactive message to Teams user: {UserName}, Conv={ConversationId} Ch={ChannelId} ServiceUrl={ServiceUrl}", userName, reference.ConversationId, channelId, effectiveServiceUrl);

        try
        {
            //TODO
            var sdkRef = new Microsoft.Agents.Core.Models.ConversationReference
            {
                Agent = new ChannelAccount { Id = reference.BotId },
                ChannelId = channelId!,
                ServiceUrl = effectiveServiceUrl,
                Conversation = new ConversationAccount { Id = reference.ConversationId }
            };
            await _channelAdapter.ContinueConversationAsync(
           appId,
           sdkRef,
           async (turnContext, token) =>
           {
               await turnContext.SendActivityAsync(message, cancellationToken: token);
           },
           ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending proactive message to Teams user: {UserName}", reference.ConversationId);
            throw;
        }

    }

    private string? ResolveAppIdForServiceUrl(string serviceUrl)
    {
        if (_configuration is null) return null;
        var map = _configuration.GetSection("ConnectionsMap");
        if (!map.Exists()) return null;
        foreach (var entry in map.GetChildren())
        {
            var pattern = entry.GetValue<string>("ServiceUrl");
            var connectionName = entry.GetValue<string>("Connection");
            if (string.IsNullOrWhiteSpace(pattern) || string.IsNullOrWhiteSpace(connectionName)) continue;
            if (WildcardMatch(serviceUrl, pattern))
            {
                var conn = _configuration.GetSection("Connections").GetSection(connectionName);
                var clientId = conn.GetSection("Settings").GetValue<string>("ClientId");
                if (!string.IsNullOrWhiteSpace(clientId)) return clientId;
            }
        }
        return null;
    }

    private bool WildcardMatch(string text, string pattern)
    {
        var regex = "^" + Regex.Escape(pattern).Replace("\\*", ".*") + "$";
        return Regex.IsMatch(text, regex, RegexOptions.IgnoreCase);
    }
}
