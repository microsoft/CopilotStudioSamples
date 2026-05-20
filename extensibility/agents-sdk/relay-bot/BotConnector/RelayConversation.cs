// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

using System;

namespace Microsoft.PowerVirtualAgents.Samples.RelayBotSample
{
    /// <summary>
    /// Data model class for Power Virtual Agent conversation
    /// </summary>
    public class RelayConversation
    {
        public string ConversationtId { get; set; }

        public string WaterMark { get; set; }

        public string Token { get; set; }

        public DateTime LastTokenRefreshTime { get; set; } = DateTime.Now;

        public DateTime LastConversationUpdateTime { get; set; } = DateTime.Now;
    }
}