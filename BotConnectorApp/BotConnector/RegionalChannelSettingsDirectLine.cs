// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

using Newtonsoft.Json;
using System.Collections.Generic;

namespace Microsoft.PowerVirtualAgents.Samples.BotConnectorApp
{
    /// <summary>
    /// class for serialization/deserialization RegionalChannelSettingsDirectLine
    /// </summary>
    public class RegionalChannelSettingsDirectLine
    {
        public IReadOnlyDictionary<string, string> ChannelUrlsById { get; set; }

        public string Geo { get; set; }
    }
}
