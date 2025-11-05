var builder = WebApplication.CreateBuilder(args);

builder.WebHost.ConfigureKestrel(serverOptions =>
{
    serverOptions.ListenAnyIP(5000);
});

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSingleton<ChatStorageService>();
builder.Services.AddHttpClient<WebhookService>();

var app = builder.Build();

var webhookUrl = app.Configuration["WebhookSettings:OutgoingWebhookUrl"];
app.Logger.LogInformation("Webhook URL configured: {WebhookUrl}", webhookUrl);

app.UseDefaultFiles();
app.UseStaticFiles();
app.UseRouting();
app.MapControllers();

app.Run();
