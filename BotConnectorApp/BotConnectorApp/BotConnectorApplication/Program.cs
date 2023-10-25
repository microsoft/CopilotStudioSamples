// See https://aka.ms/new-console-template for more information
using BotConnectorApplication.Models;
using Microsoft.Extensions.Configuration;

IConfiguration configuration = new ConfigurationBuilder()
                            .AddJsonFile("appsettings.json")
                            .Build();

var builder = WebApplication.CreateBuilder(args);
var settings = builder.Configuration.GetSection("Settings").Get<Settings>();