//-----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//-----------------------------------------------------------------------------

using Microsoft.Bot.Schema;
using Newtonsoft.Json;

namespace Microsoft.PVA.Handoff
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
