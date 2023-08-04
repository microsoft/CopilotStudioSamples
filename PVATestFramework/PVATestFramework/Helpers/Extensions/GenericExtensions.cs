// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

using Newtonsoft.Json.Linq;

namespace PVATestFramework.Console.Helpers.Extensions
{
    internal static class GenericExtensions
    {
        internal static bool IsOneOf<T>(this T obj, params T[] these)
        {
            return these.Contains(obj);
        }

        internal static JObject TryParseJObject(this string inputString)
        {
            if (inputString?.TrimStart().StartsWith("{") == true)
            {
                try
                {
                    return JObject.Parse(inputString);
                }
                catch
                {
                }
            }

            return null;
        }

        internal static JObject ToJObject(this object input, bool shouldParseStrings = false)
        {
            if (input is string inputString)
            {
                if (shouldParseStrings)
                {
                    return inputString.TryParseJObject();
                }
            }
            else if (input is JObject inputJObject)
            {
                return inputJObject;
            }
            else if (input != null)
            {
                return JToken.FromObject(input) as JObject;
            }

            return null;
        }
    }
}
