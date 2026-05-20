using System.Net;
using System.Web;

public class Script : ScriptBase
{
    public override async Task<HttpResponseMessage> ExecuteAsync()
    {
        // Only rewrite for InvokeMCP — ListInstances goes to the catalog host unchanged.
        if (Context.OperationId == "InvokeMCP")
        {
            // instanceUrl contains the full MCP endpoint URL for the selected instance,
            // populated from the ListInstances dropdown (value-path: "mcpUrl").
            var query = HttpUtility.ParseQueryString(Context.Request.RequestUri.Query);
            var instanceUrl = query["instanceUrl"];

            if (!string.IsNullOrEmpty(instanceUrl))
            {
                var targetUri = new Uri(instanceUrl);

                // Rewrite the entire request URL to the instance's MCP endpoint
                var builder = new UriBuilder(Context.Request.RequestUri)
                {
                    Scheme = targetUri.Scheme,
                    Host = targetUri.Host,
                    Port = targetUri.Port,
                    Path = targetUri.AbsolutePath
                };

                // Remove instanceUrl from query string — the MCP server doesn't need it
                query.Remove("instanceUrl");
                builder.Query = query.ToString();

                Context.Request.RequestUri = builder.Uri;
            }
        }

        return await this.Context.SendAsync(this.Context.Request, this.CancellationToken);
    }
}
