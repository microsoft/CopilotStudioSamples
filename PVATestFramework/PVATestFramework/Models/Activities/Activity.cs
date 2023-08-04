// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

using Newtonsoft.Json;

namespace PVATestFramework.Console.Models.Activities
{
    public class ActivityList
    {
        [JsonProperty("list_of_conversations")]
        public List<ActivityList> list_of_conversations { get; set; }

        [JsonProperty("activities")]
        public List<Activity> Activities { get; set; }

        public ActivityList()
        {
            Activities = new List<Activity>();
            list_of_conversations = new List<ActivityList>();
        }
    }

    public class Activity
    {
        public string ValueType { get; set; }
        public string Id { get; set; }
        public string Type { get; set; }
        public int Timestamp { get; set; }
        public From From { get; set; }
        public string ChannelId { get; set; }
        public Value Value { get; set; }
        public string TextFormat { get; set; }
        public string Text { get; set; }
        public List<Attachment> Attachments { get; set; }
        public string ReplyToId { get; set; }
        public List<object> SuggestedActions { get; set; }
        public int LineNumber { get; set; }
    }

    public static class ActivityExtension
    {
        public static bool IsMessageActivityWithText(this Activity activity)
        {
            return activity.Type == "message" && !string.IsNullOrWhiteSpace(activity.Text);
        }
    }

    public class Attachment
    {
        [JsonProperty("contentType")]
        public string ContentType { get; set; }

        [JsonProperty("content")]
        public Content Content { get; set; }
    }

    public class Action
    {
        [JsonProperty("type")]
        public string Type { get; set; }

        [JsonProperty("title")]
        public string Title { get; set; }

        [JsonProperty("style")]
        public string Style { get; set; }

        [JsonProperty("data")]
        public Data Data { get; set; }
    }

    public class Body
    {
        [JsonProperty("type")]
        public string Type { get; set; }

        [JsonProperty("columns", NullValueHandling = NullValueHandling.Ignore)]
        public List<Column>? Columns { get; set; }

        [JsonProperty("size", NullValueHandling = NullValueHandling.Ignore)]
        public string? Size { get; set; }

        [JsonProperty("weight", NullValueHandling = NullValueHandling.Ignore)]
        public string? Weight { get; set; }

        [JsonProperty("text", NullValueHandling = NullValueHandling.Ignore)]
        public string? Text { get; set; }

        [JsonProperty("wrap", NullValueHandling = NullValueHandling.Ignore)]
        public bool? Wrap { get; set; }

        [JsonProperty("items", NullValueHandling = NullValueHandling.Ignore)]
        public List<Item>? Items { get; set; }
    }

    public class Column
    {
        [JsonProperty("type")]
        public string Type { get; set; }

        [JsonProperty("items")]
        public List<Item> Items { get; set; }

        [JsonProperty("width")]
        public string Width { get; set; }
    }

    public class Content
    {
        [JsonProperty("type")]
        public string Type { get; set; }

        [JsonProperty("body")]
        public List<Body> Body { get; set; }

        [JsonProperty("$schema")]
        public string Schema { get; set; }

        [JsonProperty("version")]
        public string Version { get; set; }
    }

    public class Data
    {
        [JsonProperty("id")]
        public string Id { get; set; }

        [JsonProperty("action")]
        public string Action { get; set; }
    }

    public class Item
    {
        [JsonProperty("type")]
        public string Type { get; set; }

        [JsonProperty("url", NullValueHandling = NullValueHandling.Ignore)]
        public string? Url { get; set; }

        [JsonProperty("actions", NullValueHandling = NullValueHandling.Ignore)]
        public List<Action>? Actions { get; set; }
    }

    public class From
    {
        public From(string id, int role)
        {
            Id = id;
            Role = role;
        }

        public string Id { get; set; }
        public int Role { get; set; }
    }

    public class Value
    {
        [JsonProperty("triggerUtterance")]
        public string TriggerUtterance { get; set; }
        [JsonProperty("normalizedTriggerUtterance")]
        public string NormalizedTriggerUtterance { get; set; }
        [JsonProperty("intentCandidates")]
        public List<IntentCandidate> IntentCandidates { get; set; }
    }

    public class IntentCandidate
    {
        [JsonProperty("intentId")]
        public string IntentId { get; set; }

        [JsonProperty("intentScore")]
        public IntentScore IntentScore { get; set; }
    }

    public class IntentScore
    {
        [JsonProperty("score")]
        public double Score { get; set; }

        [JsonProperty("Type")]
        public int Type { get; set; }

        [JsonProperty("Title")]
        public string Title { get; set; }
    }
}
