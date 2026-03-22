// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

namespace Microsoft.PowerVirtualAgents.Samples.RelayBotSample
{
    /// <summary>
    /// class for serialization/deserialization DirectLineToken
    /// </summary>
    public class DirectLineToken
    {
        /// <summary>
        /// constructor
        /// </summary>
        /// <param name="token">Directline token string</param>
        public DirectLineToken(string token)
        {
            Token = token;
        }

        public string Token { get; set; }
    }
}
