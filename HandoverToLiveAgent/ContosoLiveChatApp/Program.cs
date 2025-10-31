var builder = WebApplication.CreateBuilder(args);

// Configure to host on port 5000
builder.WebHost.ConfigureKestrel(serverOptions =>
{
    serverOptions.ListenAnyIP(5000);
});

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSingleton<ChatService>();
builder.Services.AddHttpClient<WebhookService>();

var app = builder.Build();

// Validate webhook configuration
var webhookUrl = app.Configuration["WebhookSettings:OutgoingWebhookUrl"];
if (string.IsNullOrWhiteSpace(webhookUrl) || webhookUrl == "https://your-webhook-endpoint.com/api/messages")
{
    throw new InvalidOperationException(
        "Invalid webhook configuration. Please set a valid 'WebhookSettings:OutgoingWebhookUrl' in appsettings.json. " +
        "The default placeholder value 'https://your-webhook-endpoint.com/api/messages' is not allowed.");
}

app.Logger.LogInformation("Webhook URL configured: {WebhookUrl}", webhookUrl);

// Configure the HTTP request pipeline.
app.UseDefaultFiles();
app.UseStaticFiles();
app.UseRouting();
app.MapControllers();

app.Run();
