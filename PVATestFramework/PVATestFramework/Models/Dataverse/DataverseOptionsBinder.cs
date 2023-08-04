// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

using System.CommandLine;
using System.CommandLine.Binding;

namespace PVATestFramework.Console.Models.Dataverse
{
    internal class DataverseOptionsBinder : BinderBase<DataverseOptions>
    {
        private readonly Option<string> _clientId;
        private readonly Option<string> _clientSecret;
        private readonly Option<string> _dataverseUri;
        private readonly Option<string> _tenantId;
        private readonly Option<string> _botId;

        public DataverseOptionsBinder(Option<string> clientId, Option<string> clientSecret, Option<string> dataverseUri, Option<string> tenantId, Option<string> botId)
        {
            _clientId = clientId;
            _clientSecret = clientSecret;
            _dataverseUri = dataverseUri;
            _tenantId = tenantId;
            _botId = botId;
        }

        protected override DataverseOptions GetBoundValue(BindingContext bindingContext)
        {
            return new DataverseOptions
            {
                ClientId = bindingContext.ParseResult.GetValueForOption(_clientId),
                ClientSecret = bindingContext.ParseResult.GetValueForOption(_clientSecret),
                EnvironmentUrl = bindingContext.ParseResult.GetValueForOption(_dataverseUri),
                TenantId = bindingContext.ParseResult.GetValueForOption(_tenantId),
                BotId = bindingContext.ParseResult.GetValueForOption(_botId)
            };
        }
    }
}
