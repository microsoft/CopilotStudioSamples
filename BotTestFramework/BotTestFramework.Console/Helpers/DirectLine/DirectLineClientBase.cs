// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

using Microsoft.Bot.Connector.DirectLine;

namespace BotTestFramework.Console.Helpers.DirectLine
{
    public interface DirectLineClientBase : IDisposable
    {
        public Task SendActivityAsync(Activity activity, CancellationToken cancellationToken);

        public Task<List<Activity>> ReceiveActivitiesAsync(CancellationToken cancellationToken);

        public void Dispose();
    }
}
