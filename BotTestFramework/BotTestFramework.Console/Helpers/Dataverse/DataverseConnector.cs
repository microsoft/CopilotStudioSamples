// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

using BotTestFramework.Console.Helpers.Extensions;
using BotTestFramework.Console.Helpers.FileHandler;
using BotTestFramework.Console.Models.Dataverse;
using Microsoft.Identity.Client;
using Newtonsoft.Json;
using Serilog;
using System.Net.Http.Headers;
using LoggerExtensions = BotTestFramework.Console.Helpers.Extensions.LoggerExtensions;

namespace BotTestFramework.Console.Helpers.Dataverse
{
    public class DataverseConnector
    {
        private readonly DataverseOptions _options;
        private readonly HttpClient httpClient;
        private readonly IFileHandler fileHandler;

        public DataverseConnector(DataverseOptions options, HttpClient httpClient, IFileHandler fileHandler)
        {
            _options = options;
            Log.Logger = new LoggerConfiguration()
                .MinimumLevel.Debug()
                .WriteTo.Console(outputTemplate: "{Message}{NewLine}")
                .CreateLogger();
            this.httpClient = httpClient;
            this.fileHandler = fileHandler;
        }

        /// <summary>
        /// Get data from dataverse based on the chat transcript table.
        /// </summary>
        /// <param name="endpoint"></param>
        /// <param name="interactive"></param>
        /// <param name="path"></param>
        /// <returns>result as a string</returns>
        public async Task<bool> GetJsonFromDataverseAsync(string endpoint, bool interactive, string path)
        {
            try
            {
                Log.Information("The Chat Transcript download has started...");
                string token = string.Empty;

                if (interactive)
                {
                    token = await GetTokenAsyncInteractive();
                }
                else
                {
                    token = await GetTokenAsync();
                }

                httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

                if (!await ValidateBotIdAsync(endpoint))
                {
                    return false;
                }

                var response = await httpClient.GetAsync(endpoint);
                if (response.StatusCode != System.Net.HttpStatusCode.OK)
                {
                    throw new Exception(response.StatusCode.ToString());
                }

                var content = response.Content.ReadAsStringAsync();
                var jsonDeserialized = JsonConvert.DeserializeObject<InputDataverse>(content.Result);
                var filepath = string.Empty;

                if (Path.IsPathFullyQualified(path))
                {
                    filepath = path;
                }
                else
                {
                    filepath = Path.GetFullPath(path);
                }

                if (!filepath.EndsWith(".json"))
                {
                    throw new Exception("The file should have a .json extension.");
                }

                Log.Information($"Saving file in {filepath}");

                var conversations = string.Join(',', jsonDeserialized.Value.Select((v) => v.Content));
                var fileContent = $"{{\"list_of_conversations\":[{conversations}]}}";                  
                fileHandler.CheckFilePath(filepath);
                fileHandler.WriteToFile(filepath, fileContent);

                Log.Information("The Chat Transcript download ended.");
                return true;
            }
            catch (Exception ex)
            {
                Log.Logger.ForegroundColor($"An error occurred while obtaining data from Dataverse. Details: {ex.Message}", LoggerExtensions.LogLevel.Fatal, LoggerExtensions.Red);
                return false;
            }
        }

        private async Task<bool> ValidateBotIdAsync(string endpoint)
        {
            var baseUri = new Uri(endpoint);
            var botsUri = $"{baseUri.Scheme}://{baseUri.Host}{Constants.DataverseBotUri}?$filter=botid%20eq%20{_options.BotId}";
            var response = await httpClient.GetAsync(botsUri);

            if (response.StatusCode == System.Net.HttpStatusCode.Forbidden)
            {
                throw new Exception("The ClientID does not have permissions to access the Dataverse environment.");
            }
            else if (response.StatusCode != System.Net.HttpStatusCode.OK)
            {
                throw new Exception("The botId is not valid or does not belong to the Environment Url provided.");
            }

            return response.StatusCode == System.Net.HttpStatusCode.OK;
        }

        /// <summary>
        /// Get a token to connect to Dataverse.
        /// </summary>
        /// <param name="client"></param>
        /// <returns>directline token as a string</returns>
        /// <exception cref="Exception"></exception>
        private async Task<string> GetTokenAsync()
        {
            var tokenUri = Constants.DataverseTokenUri.Replace("{TenantId}", _options.TenantId);
            var uri = _options.EnvironmentUrl;
            var authBody = new Dictionary<string, string> {
                { "client_id", _options.ClientId },
                { "client_secret", _options.ClientSecret },
                { "scope", $"{uri}/.default"},
                { "grant_type", "client_credentials"}
            };

            var token = string.Empty;
            var authBodyEncoded = new FormUrlEncodedContent(authBody);
            var response = await httpClient.PostAsync(tokenUri, authBodyEncoded);
            var responseString = await response.Content.ReadAsStringAsync();
            var values = JsonConvert.DeserializeObject<Dictionary<string, object>>(responseString);

            if (values != null)
            {
                if (values.ContainsKey("access_token"))
                {
                    token = values["access_token"].ToString();
                }
                else
                {
                    throw new Exception(values["error_description"].ToString());
                }
            }

            return token;
        }

        /// <summary>
        /// Get a token using an interactive login to connect to Dataverse.
        /// </summary>
        /// <returns>directline token as a string</returns>
        /// <exception cref="Exception"></exception>
        private async Task<string> GetTokenAsyncInteractive()
        {
            var redirectUri = "http://localhost";
            var uri = _options.EnvironmentUrl;
            // MSAL authentication
            var authBuilder = PublicClientApplicationBuilder.Create(_options.ClientId)
                .WithAuthority(AadAuthorityAudience.AzureAdMultipleOrgs)
                .WithRedirectUri(redirectUri)
                .Build();
            var scope = uri + "/.default";
            string[] scopes = { scope };

            var cancelTokenSource = new CancellationTokenSource();
            cancelTokenSource.CancelAfter(TimeSpan.FromSeconds(60));
            AuthenticationResult token = null;

            try
            {
                token = await authBuilder.AcquireTokenInteractive(scopes).ExecuteAsync(cancelTokenSource.Token);
            }
            catch (OperationCanceledException ex)
            {
                if (ex.CancellationToken == cancelTokenSource.Token)
                {
                    throw new Exception("User canceled authentication or did not complete the sign-in process.");
                }
            }
            catch (Exception ex)
            {
                throw new Exception(ex.Message);
            }

            return await Task.FromResult(token?.AccessToken ?? string.Empty);
        }

    }
}
