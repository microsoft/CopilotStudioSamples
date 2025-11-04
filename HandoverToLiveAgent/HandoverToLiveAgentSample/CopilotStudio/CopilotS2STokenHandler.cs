// using System.Net.Http.Headers;
// using Microsoft.Agents.CopilotStudio.Client;
// using Microsoft.Extensions.Options;
// using Microsoft.Identity.Client;

namespace HandoverToLiveAgent.CopilotStudio;

// public class CopilotS2STokenHandler : DelegatingHandler
// {
//     private readonly IConfidentialClientApplication _cca;
//     private readonly string[] _scopes;

//     public CopilotS2STokenHandler(ConnectionSettings settings, IOptions<M365AgentOptions> m365Opts)
//     {
//         var o = m365Opts.Value;
//         _scopes = [CopilotClient.ScopeFromSettings(settings)];
//         _cca = ConfidentialClientApplicationBuilder.Create(o.ClientId)
//             .WithAuthority(AzureCloudInstance.AzurePublic, o.TenantId)
//             .WithClientSecret(o.ClientSecret)
//             .Build();
//     }

//     protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
//     {
//         if (request.Headers.Authorization is null)
//         {
//             var result = await _cca.AcquireTokenForClient(_scopes).ExecuteAsync(cancellationToken);
//             request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", result.AccessToken);
//         }
//         return await base.SendAsync(request, cancellationToken);
//     }
// }

// public class M365AgentOptions
// {
//     public string TenantId { get; set; } = string.Empty;
//     public string ClientId { get; set; } = string.Empty;
//     public string ClientSecret { get; set; } = string.Empty;
//     public string EnvironmentId { get; set; } = string.Empty;
//     public string BotId { get; set; } = string.Empty;
//     public string Scope { get; set; } = "https://graph.microsoft.com/.default";
// }
