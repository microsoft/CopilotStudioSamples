using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text;
using System.Threading.Tasks;
using BotConnectorApp.Service.Models;

namespace BotConnectorApp.Service
{
    public class BotService : IBotService
    {
        private HttpClient _httpClient;

        public BotService() 
        {
            _httpClient = new HttpClient();
        }

        public async Task<RegionalChannelSettingsDirectLine> GetRegionalChannelSettingsDirectline(string tokenEndpoint)
        { 
            string environmentEndPoint = tokenEndpoint.Substring(0, tokenEndpoint.IndexOf("/powervirtualagents/"));
            string apiVersion = tokenEndpoint.Substring(tokenEndpoint.IndexOf("api-version")).Split("=")[1];
            var regionalChannelSettingsURL = $"{environmentEndPoint}/powervirtualagents/regionalchannelsettings?api-version={apiVersion}";

            try
            {
                var regionalSettings = await _httpClient.GetFromJsonAsync<RegionalChannelSettingsDirectLine>(regionalChannelSettingsURL);
                return regionalSettings;
            }
            catch (HttpRequestException ex)
            {
                throw ex;
            }
            
        }
            

        public async Task<DirectLineToken> GetTokenAsync(string url)
        {
            try
            {
                return await _httpClient.GetFromJsonAsync<DirectLineToken>(url);
            }
            catch (HttpRequestException ex)
            {
                throw ex;
            }        
        }
    }
}
