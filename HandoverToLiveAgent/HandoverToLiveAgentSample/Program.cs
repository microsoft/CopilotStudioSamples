using Microsoft.Agents.Builder;
using Microsoft.Agents.CopilotStudio.Client;
using Microsoft.Agents.Hosting.AspNetCore;
using Microsoft.Extensions.Options;
using HandoverToLiveAgent.LiveChat;
using Microsoft.Agents.CopilotStudio;
using HandoverToLiveAgent.CopilotStudio;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.ConfigureKestrel(serverOptions =>
{
    serverOptions.ListenAnyIP(5001);
});

builder.Services.AddScoped<ILiveChatService, LiveChatService>();
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddHttpClient();

// Add services to the container.
builder.Services.AddSingleton<IConversationManager, ConversationManager>();
builder.Services.AddSingleton<IProactiveMessenger, MsTeamsProactiveMessage>();

// Agents SDK setup
builder.Services.AddHttpClient();
builder.AddAgentApplicationOptions();
builder.AddAgent<HandoverToLiveAgent.CopilotStudio.CopilotStudioAgent>();
// Agents storage for conversation state
builder.Services.AddSingleton<Microsoft.Agents.Storage.IStorage, Microsoft.Agents.Storage.MemoryStorage>();
// Ensure AgentApplicationOptions is available for AgentApplication-based skills
builder.Services.AddSingleton<Microsoft.Agents.Builder.App.AgentApplicationOptions>();

var app = builder.Build();

// Only enforce HTTPS when an HTTPS binding is configured (avoid warnings when running HTTP-only locally)
var hasHttpsBinding =
    !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("HTTPS_PORTS")) ||
    !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("ASPNETCORE_HTTPS_PORT")) ||
    builder.Configuration.GetSection("Kestrel:Endpoints:Https").Exists();

if (!app.Environment.IsDevelopment() && hasHttpsBinding)
{
    app.UseHttpsRedirection();
}

// app.UseCors();
app.UseStaticFiles();
// app.UseRouting();
// Bot middleware is configured via the Bot Adapter, not ASP.NET pipeline. None registered here for local run.
// app.UseAuthorization();
app.MapControllers();

// Agents endpoint: /api/messages for incoming messages and activities from Copilot Studio skills
var incomingRoute = app.MapPost("/api/messages", async (HttpRequest request,
    HttpResponse response, IAgentHttpAdapter adapter, IAgent agent, CancellationToken ct) =>
{
    await adapter.ProcessAsync(request, response, agent, ct);
});
app.Run();
