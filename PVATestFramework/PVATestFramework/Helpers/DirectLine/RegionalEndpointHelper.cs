// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

using PVATestFramework.Console.Models.DirectLine;
using Newtonsoft.Json;

namespace PVATestFramework.Console.Helpers.DirectLine
{
    public static class RegionalEndpointHelper
    {
        public static async Task<Uri> GetEndpointAsync(Uri botUrl)
        {
            string apiVersion = Constants.DefaultApiVersion;
            if (!String.IsNullOrEmpty(botUrl.Query))
            {
                // Parse the query string included in the botUrl
                var substring = botUrl.Query.Substring(1);
                var parameters = substring.Split('&');
                foreach (var parameter in parameters)
                {
                    // Get the api-version value from the query string
                    var namevaluepair = parameter.Split('=');
                    if (namevaluepair[0].Equals("api-version", StringComparison.InvariantCultureIgnoreCase))
                    {
                        // Override the default api-version value
                        apiVersion = parameter;
                        break;
                    }
                }
            }

            var builder = new UriBuilder();
            builder.Scheme = botUrl.Scheme;
            builder.Host = botUrl.Host;
            builder.Path = Constants.RegionalChannelPath;
            builder.Query = apiVersion;

            // Set the default direct line endpoint
            string endpointUrl = Constants.DLDefaultUri;
            using (var client = new HttpClient())
            {
                using HttpRequestMessage httpRequest = new();
                httpRequest.Method = HttpMethod.Get;
                httpRequest.RequestUri = builder.Uri;
                using (var response = await client.SendAsync(httpRequest))
                {
                    if (response.IsSuccessStatusCode)
                    {
                        // Get the regional direct line endpoint
                        var responseString = await response.Content.ReadAsStringAsync();
                        var dlEndpoint = JsonConvert.DeserializeObject<DirectLineEndPointReturn>(responseString);
                        if (!String.IsNullOrEmpty(dlEndpoint.ChannelUrlsById.DirectLine))
                        {
                            // Override the default value
                            endpointUrl = dlEndpoint.ChannelUrlsById.DirectLine;
                        }
                    }
                }
            }

            return new Uri(endpointUrl);
        }
    }
}
