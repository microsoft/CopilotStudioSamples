using BotConnectorApp.Service.Models;

namespace BotConnectorApp.Service
{
    public interface IBotService
    {
        Task<RegionalChannelSettingsDirectLine> GetRegionalChannelSettingsDirectline(string tokenEndpoint)
;
        Task<DirectLineToken> GetTokenAsync(string url);

    }
}