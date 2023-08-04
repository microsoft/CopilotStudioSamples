// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

using PVATestFramework.Console.Helpers.Extensions;
using Microsoft.Bot.Connector.DirectLine;
using Newtonsoft.Json.Linq;
using static PVATestFramework.Console.Helpers.AdaptiveCard;

namespace PVATestFramework.Console.Helpers
{
    public class AdaptiveCardTranslatorSettings
    {
        public string[] PropertiesToTranslate { get; set; }

        public AdaptiveCardTranslatorSettings()
        {
            PropertiesToTranslate = new[]
                {
                AdaptiveProperties.Value,
                AdaptiveProperties.Text,
                AdaptiveProperties.AltText,
                AdaptiveProperties.FallbackText,
                AdaptiveProperties.DisplayText,
                AdaptiveProperties.Title,
                AdaptiveProperties.Placeholder,
                AdaptiveProperties.Data,
                AdaptiveProperties.URL,
            };
        }
    }

    public static class AdaptiveCard
    {
        internal class AdaptiveInputTypes
        {
            public const string ChoiceSet = "Input.ChoiceSet";
            public const string Date = "Input.Date";
            public const string Number = "Input.Number";
            public const string Text = "Input.Text";
            public const string Time = "Input.Time";
            public const string Toggle = "Input.Toggle";
        }

        internal class AdaptiveProperties
        {
            public const string Actions = "actions";
            public const string AltText = "altText";
            public const string Body = "body";
            public const string Data = "data";
            public const string DisplayText = "displayText";
            public const string Facts = "facts";
            public const string FallbackText = "fallbackText";
            public const string Id = "id";
            public const string Inlines = "inlines";
            public const string Placeholder = "placeholder";
            public const string Text = "text";
            public const string Title = "title";
            public const string Type = "type";
            public const string Value = "value";
            public const string URL = "url";
        }

        public static string GetCardWithoutValues(
            JObject cardJObject,
            AdaptiveCardTranslatorSettings settings)
        {
            var tokens = new List<JToken>();

            // Find potential strings
            foreach (var token in cardJObject.Descendants().Where(token => token.Type == JTokenType.String))
            {
                var parent = token.Parent;

                if (parent != null)
                {
                    var shouldRemoveValue = false;
                    var container = parent.Parent;

                    switch (parent.Type)
                    {
                        // If the string is the value of a property
                        case JTokenType.Property:
                            var propertyName = (parent as JProperty).Name;
                            if (settings.PropertiesToTranslate?.Contains(propertyName) == true
                                && (propertyName != AdaptiveProperties.Value || IsValueReplaceable(container as JObject)))
                            {
                                shouldRemoveValue = true;
                            }

                            break;

                        // If the string is in an array
                        case JTokenType.Array:
                            if (IsArrayElementReplaceable(container))
                            {
                                shouldRemoveValue = true;
                            }

                            break;
                    }

                    if (shouldRemoveValue)
                    {
                        token.Replace(string.Empty);
                    }
                }
            }

            return cardJObject.ToString();
        }

        private static bool IsArrayElementReplaceable(JContainer arrayContainer)
            => (arrayContainer as JProperty)?.Name == AdaptiveProperties.Inlines;

        private static bool IsValueReplaceable(JObject valueContainer)
        {
            if (valueContainer is null)
            {
                return false;
            }

            var elementType = valueContainer[AdaptiveProperties.Type];
            var parent = valueContainer.Parent;
            var grandparent = parent?.Parent;

            return (elementType?.Type == JTokenType.String
                    && elementType.IsOneOf(AdaptiveInputTypes.Text, ActionTypes.ImBack))
                || (elementType == null
                    && (grandparent as JProperty)?.Name == AdaptiveProperties.Facts
                    && parent.Type == JTokenType.Array);
        }
    }
}
