// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

using Newtonsoft.Json;

namespace TranslationBot.Translation.Model
{
    /// <summary>
    /// Detector result from Translator API v3.
    /// </summary>
    internal class DetectorResponse
    {
        [JsonProperty("language")]
        public string Language { get; set; }

        [JsonProperty("score")]
        public float Score { get; set; }

        [JsonProperty("isTranslationSupported")]
        public bool IsTranslationSupported { get; set; }

        [JsonProperty("isTransliterationSupported")]
        public bool IsTransliterationSupported { get; set; }
    }
}
