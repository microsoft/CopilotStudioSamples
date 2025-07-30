// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

using System.Collections.Generic;

namespace Microsoft.Translation.Helpers
{
    /// <summary>
    /// General translation settings and constants.
    /// </summary>
    public static class TranslationSettings
    {
        public const string DefaultLanguage = "en";
        public const string DefaultDictionaryKey = "language";
        public const string OcChannelId = "omnichannel";
        public static readonly List<string> OcControlTag = new() { "OmnichannelContextMessage", "Hidden" };
    }
}
