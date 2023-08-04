// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

using Newtonsoft.Json;

namespace PVATestFramework.Console.Models.DirectLine
{
    public class ChannelUrlsById
    {
        [JsonProperty("directline")]
        public string DirectLine { get; set; }
    }

    public class DirectLineEndPointReturn
    {
        [JsonProperty("channelUrlsById")]
        public ChannelUrlsById ChannelUrlsById { get; set; }

        [JsonProperty("geo")]
        public string Geo { get; set; }
    }
}