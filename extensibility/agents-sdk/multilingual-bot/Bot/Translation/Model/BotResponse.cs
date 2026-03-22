// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

using Microsoft.Bot.Schema;
using Newtonsoft.Json;

namespace TranslationBot.Translation.Model
{
    /// <summary>
    /// Activities that are received by the user in response to their query
    /// </summary>
    public class BotResponse
    {
        /// <summary>
        /// Activities that are a part of the bot response
        /// </summary>
        [JsonProperty(PropertyName = "activities")]
        public Activity[] Activities { get; set; }
    }
}
