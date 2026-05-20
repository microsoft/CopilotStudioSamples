// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

using Newtonsoft.Json;

namespace TranslationBot.Translation.Model
{
    public class HandoffContext
    {
        /// <summary>
        /// Scope of the activity - bot/user
        /// </summary>
        [JsonProperty(PropertyName = "va_Scope")]
        public string Scope { get; set; }

        /// <summary>
        /// Last topic triggered in conversation
        /// </summary>
        [JsonProperty(PropertyName = "va_LastTopic")]
        public string LastTopic { get; set; }

        /// <summary>
        /// All topics triggered in conversation
        /// </summary>
        [JsonProperty(PropertyName = "va_Topics")]
        public string[] Topics { get; set; }

        /// <summary>
        /// Last user phrase
        /// </summary>
        [JsonProperty(PropertyName = "va_LastPhrase")]
        public string LastPhrase { get; set; }

        /// <summary>
        /// All user phrases
        /// </summary>
        [JsonProperty(PropertyName = "va_Phrases")]
        public string[] Phrases { get; set; }

        /// <summary>
        /// Conversation Id
        /// </summary>
        [JsonProperty(PropertyName = "va_ConversationId")]
        public string ConversationId { get; set; }

        /// <summary>
        /// Message for agent as configured in dialog
        /// </summary>
        [JsonProperty(PropertyName = "va_AgentMessage")]
        public string AgentMessage { get; set; }

        /// <summary>
        /// Bot Id
        /// </summary>
        [JsonProperty(PropertyName = "va_BotId")]
        public string BotId { get; set; }

        /// <summary>
        /// Bot Name
        /// </summary>
        [JsonProperty(PropertyName = "va_BotName")]
        public string BotName { get; set; }

        /// <summary>
        /// Language
        /// </summary>
        [JsonProperty(PropertyName = "va_Language")]
        public string Language { get; set; }

        /// <summary>
        /// MS Caller Id
        /// </summary>
        [JsonProperty(PropertyName = "MSCallerId")]
        public string MSCallerId { get; set; }
    }
}
