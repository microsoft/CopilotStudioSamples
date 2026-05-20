// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Bot.Builder;
using Microsoft.Extensions.Configuration;
using Newtonsoft.Json;
using TranslationBot.Translation.Helpers;
using TranslationBot.Translation.Model;

namespace TranslationBot.Translation
{
    public class TranslatorService
    {
        private const string Host = "https://api.cognitive.microsofttranslator.com";
        private const string TranslatePath = "/translate?api-version=3.0";
        private const string DetectPath = "/detect?api-version=3.0";

        private static HttpClient _client = new HttpClient();

        private readonly string _key;
        private readonly string _region;
        private readonly Dictionary<string, TranslatorDictionary> _categoryId;


        public TranslatorService(IConfiguration configuration, UserState userState)
        {
            var key = configuration["TranslatorKey"];
            var region = configuration["TranslatorRegion"];
            var categoryId = configuration.GetSection("TranslatorCategoryId").Get<Dictionary<string, TranslatorDictionary>>();

            _key = key ?? throw new ArgumentNullException(nameof(key));
            _region = region ?? throw new ArgumentNullException(nameof(region));
            _categoryId = categoryId;
        }

        public async Task<string> TranslateAsync(string text, CancellationToken cancellationToken, string fromLanguage, string toLanguage)
        {
            if (fromLanguage != toLanguage)
            {
                var path = $"{TranslatePath}&from={fromLanguage}&to={toLanguage}";
                if (_categoryId != null && _categoryId.ContainsKey(fromLanguage))
                { 
                    path += $"&category={_categoryId[fromLanguage].dictionary}";  
                }

                var responseBody = await MakeRequest(path, text, cancellationToken);
                var result = JsonConvert.DeserializeObject<TranslatorResponse[]>(responseBody);

                return result?.FirstOrDefault()?.Translations?.FirstOrDefault()?.Text;

            }
            else
            {
                return text;
            }
        }

        public async Task<string> DetectAsync(string text, CancellationToken cancellationToken = default(CancellationToken))
        {

            var responseBody = await MakeRequest(DetectPath, text, cancellationToken);
            var result = JsonConvert.DeserializeObject<DetectorResponse[]>(responseBody);
            var language = result?.FirstOrDefault()?.Language;
            return language;

        }

        public async Task<string> MakeRequest(string path, string text, CancellationToken cancellationToken)
        {
            // From Cognitive Services translation documentation:
            //https://docs.microsoft.com/en-us/azure/cognitive-services/Translator/quickstart-translator?tabs=csharp#detect-language
            var body = new object[] { new { Text = text } };
            var requestBody = JsonConvert.SerializeObject(body);

            using (var request = new HttpRequestMessage())
            {
                var uri = Host + path;
                request.Method = HttpMethod.Post;
                request.RequestUri = new Uri(uri);
                request.Content = new StringContent(requestBody, Encoding.UTF8, "application/json");
                request.Headers.Add("Ocp-Apim-Subscription-Key", _key);
                request.Headers.Add("Ocp-Apim-Subscription-Region", _region);

                var response = await _client.SendAsync(request, cancellationToken);

                if (!response.IsSuccessStatusCode)
                {
                    throw new Exception($"The call to the translation service returned HTTP status code {response.StatusCode}.");
                }

                return await response.Content.ReadAsStringAsync();

            }
        }
    }
}
