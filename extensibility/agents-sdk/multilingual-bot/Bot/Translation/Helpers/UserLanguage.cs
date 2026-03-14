// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

using System;
using System.Collections.Concurrent;
using Microsoft.Translation.Helpers;

namespace TranslationBot.Translation.Helpers
{
    /// <summary>
    /// Dictionary for setting the language send through the URL
    /// </summary>
    public class UserLanguage : ConcurrentDictionary<string, string>
    {
        public String Get(string userName)
        {
            if (TryGetValue(userName, out String value))
            {
                return value;
            }

            return null;
        }

        public void Save(String languageUrl)
        {
            AddOrUpdate(
                TranslationSettings.DefaultDictionaryKey,
                languageUrl,
                (key, oldValue) => languageUrl);
        }
    }
}
