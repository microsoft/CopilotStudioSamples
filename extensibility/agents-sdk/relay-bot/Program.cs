// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

using Microsoft.AspNetCore.Builder;
using Microsoft.Bot.Builder;
using Microsoft.Bot.Builder.Integration.AspNet.Core;
using Microsoft.Bot.Connector.Authentication;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.PowerVirtualAgents.Samples.RelayBotSample;
using Microsoft.PowerVirtualAgents.Samples.RelayBotSample.Bots;

var builder = WebApplication.CreateBuilder(args);

//---- Configure services ----
builder.Services.AddHttpClient();
builder.Services.AddControllers()
    .AddNewtonsoftJson(options =>
    {
        options.SerializerSettings.MaxDepth = HttpHelper.BotMessageSerializerSettings.MaxDepth;
    });


builder.Services.AddSingleton<BotFrameworkAuthentication, ConfigurationBotFrameworkAuthentication>();

// Create the Bot Adapter with error handling enabled.
builder.Services.AddSingleton<IBotFrameworkHttpAdapter, AdapterWithErrorHandler>();

// Create the bot as a transient. In this case the ASP Controller is expecting an IBot.
builder.Services.AddSingleton<IBot, RelayBot>();

// Create the singleton instance of BotService from appsettings
var botService = new BotService();
builder.Configuration.Bind("BotService", (object)botService);
builder.Services.AddSingleton<IBotService>(botService);

// Create the singleton instance of ConversationPool from appsettings
var conversationManager = new ConversationManager();
builder.Configuration.Bind("ConversationPool", conversationManager);
builder.Services.AddSingleton(conversationManager);

var app = builder.Build();

//--- - Configure the HTTP request pipeline ----
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}
else
{
    app.UseHsts();
}

app.UseDefaultFiles()
    .UseStaticFiles()
    .UseWebSockets()
    .UseRouting();

app.MapControllers();

app.Run();
