using A2A.AspNetCore;
using Azure;
using Azure.AI.OpenAI;
using Microsoft.Agents.AI.Hosting;
using Microsoft.Extensions.AI;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
builder.Services.AddSwaggerGen();

string endpoint = builder.Configuration["AZURE_OPENAI_ENDPOINT"]
    ?? throw new InvalidOperationException("AZURE_OPENAI_ENDPOINT is not set.");
string deploymentName = builder.Configuration["AZURE_OPENAI_DEPLOYMENT_NAME"]
    ?? throw new InvalidOperationException("AZURE_OPENAI_DEPLOYMENT_NAME is not set.");
string apiKey = builder.Configuration["AZURE_OPENAI_API_KEY"]
    ?? throw new InvalidOperationException("AZURE_OPENAI_API_KEY is not set.");

// Register the chat client
IChatClient chatClient = new AzureOpenAIClient(
        new Uri(endpoint),
        new AzureKeyCredential(apiKey))
    .GetChatClient(deploymentName)
    .AsIChatClient();
builder.Services.AddSingleton(chatClient);

// Register an agent
var botanicalAgent = builder.AddAIAgent("botanical", instructions: "You are a very knowledgeable botanical expert. In all your responses, you begin by introducing yourself as 'BotaniBot, your friendly botanical assistant.'");

var app = builder.Build();

app.UseMiddleware<A2A_Agent_Framework.JsonRpcMiddleware>();

app.MapOpenApi();
app.UseSwagger();
app.UseSwaggerUI();

// Expose the agent via A2A protocol. You can also customize the agentCard
app.MapA2A(botanicalAgent, path: "/a2a/botanical", agentCard: new()
{
    Name = "Botanical Agent",
    Description = "An agent that provides information about plants and botany.",
    Version = "1.0",
    Url = "https://<YOUR_URL>/a2a/botanical/v1/card",
    Capabilities = new A2A.AgentCapabilities
    {
        Streaming = true,
        PushNotifications = false,
        StateTransitionHistory = false,
        Extensions = new List<A2A.AgentExtension>()
    }
});

app.Run();