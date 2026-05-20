// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

using Microsoft.Bot.Configuration;
using Microsoft.Bot.Connector.DirectLine;
using Microsoft.Extensions.Configuration;
using Microsoft.Rest.Serialization;
using System;
using System.Net.Http;
using System.Threading.Tasks;
using TranslationBot.Translation.Model;

namespace TranslationBot.Translation
{
    /// <summary>
    /// Bot Service class to interact with bot
    /// </summary>
    public class TokenService
    {
        private static readonly HttpClient s_httpClient = new HttpClient();
        private readonly string _botId;
        private readonly string _tenantId;
        private readonly string _tokenEndPoint;

        public TokenService(IConfiguration configuration)
        {
            _botId = configuration["BotId"];
            _tenantId = configuration["TenantId"];
            _tokenEndPoint = configuration["TokenEndPoint"];
        }

        /// <summary>
        /// Get directline token for connecting bot
        /// </summary>
        /// <returns>directline token as string</returns>
        public async Task<string> GetTokenAsync()
        {
            string token;
            using (var httpRequest = new HttpRequestMessage())
            {
                httpRequest.Method = HttpMethod.Get;
                UriBuilder uriBuilder = new UriBuilder(_tokenEndPoint);
                uriBuilder.Query = $"botId={_botId}&tenantId={_tenantId}";
                httpRequest.RequestUri = uriBuilder.Uri;
                using (var response = await s_httpClient.SendAsync(httpRequest))
                {
                    var responseString = await response.Content.ReadAsStringAsync();
                    token = SafeJsonConvert.DeserializeObject<DirectLineToken>(responseString).Token;
                }
            }

            return token;
        }

        /// <summary>
        /// TODO
        /// </summary>
        /// <returns>directline token as string</returns>
        private static DirectLineClient RefreshToken(string currentToken)
        {
            string refreshToken = new DirectLineClient(currentToken).Tokens.RefreshToken().Token;
            // create a new directline client with refreshToken
            var directLineClient = new DirectLineClient(refreshToken);
            // use new directLineClient to communicate to your bot
            return directLineClient;
        }
    }
}
