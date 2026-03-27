// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

using System.Threading.Tasks;

namespace Microsoft.PowerVirtualAgents.Samples.RelayBotSample
{
    public interface IBotService
    {
        string GetBotName();

        Task<string> GetTokenAsync();
    }
}