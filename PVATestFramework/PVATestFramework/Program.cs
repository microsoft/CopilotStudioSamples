// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

using PVATestFramework.Console.Helpers;
using PVATestFramework.Console.Helpers.Dataverse;
using PVATestFramework.Console.Helpers.DirectLine;
using PVATestFramework.Console.Helpers.FileHandler;
using PVATestFramework.Console.Models.Dataverse;
using PVATestFramework.Console.Models.DirectLine;
using Serilog;
using Serilog.Core;
using System.CommandLine;

namespace PVATestFramework.Console
{
    internal class Program
	{
		static Task Main(string[] args)
		{
            var clientIdOption = new Option<string?>(
                name: "--clientId",
                description: "The client id to be used to connect with dataverse."
            );
            clientIdOption.IsRequired = true;

            var clientSecretOption = new Option<string?>(
                name: "--clientSecret",
                description: "The client secret to be used to connect with dataverse."
            );

            var environmentUrlOption = new Option<string?>(
                name: "--environmentUrl",
                description: "The environment URL to be used to connect with dataverse."
            );
            environmentUrlOption.IsRequired = true;

            var tenantIdOption = new Option<string?>(
                name: "--tenantId",
                description: "The tenant id to be used to connect with dataverse."
            );
            tenantIdOption.IsRequired = true;

            var botIdOption = new Option<string?>(
                name: "--botId",
                description: "The bot id that will be used to execute tests or download chat transcripts from dataverse."
            );
            botIdOption.IsRequired = true;

            var verboseOption = new Option<bool>(
               name: "--verbose",
               description: "This flag enables verbose output."
            );

            var logOption = new Option<bool>(
               name: "--log",
               description: "This flag generates log file output."
            );
            logOption.SetDefaultValue(false);

            var pathOption = new Option<string>(
                name: "--path",
                description: "The file or folder to be used as a source to run the test."
            );
            pathOption.IsRequired = true;

            var tokenEnpointOption = new Option<string>(
                name: "--tokenEndpoint",
                description: "The token endpoint to be used to connect with the bot to get a conversation token."
            );
            tokenEnpointOption.IsRequired = true;

            var outputFileOption = new Option<string>(
                name: "--outputFile",
                description: "The output file used to store the conversation transcript in a JSON format."
            );
            outputFileOption.IsRequired = true;

            var dymMessageOption = new Option<string>(
                name: "--dymMessage",
                description: "The message that the PVA bot sent to the user when a DYM situation is triggered."
            );
            dymMessageOption.SetDefaultValue(BotDefaultMessages.DYM);
            dymMessageOption.AddValidator(option => {
                if (!string.IsNullOrEmpty(option.GetValueForOption(dymMessageOption)))
                {
                    BotDefaultMessages.DYM = option.GetValueForOption(dymMessageOption);
                }
            });

            var noneOfTheseMessageOption = new Option<string>(
                name: "--noneOfTheseMessage",
                description: "The text for the \"None of these\" option when the DYM message is triggered."
            );
            noneOfTheseMessageOption.SetDefaultValue(BotDefaultMessages.NoneOfThese);
            noneOfTheseMessageOption.AddValidator(option => {
                if (!string.IsNullOrEmpty(option.GetValueForOption(noneOfTheseMessageOption)))
                {
                    BotDefaultMessages.NoneOfThese = option.GetValueForOption(noneOfTheseMessageOption);
                }
            });

            var command = new RootCommand("The Bot Test Framework tool allows to run tests against a PVA Bot.");
			var testCommand = new Command("test", "Execute a test (DYM, ChatTranscript or Trigger Phrases) using local files as transcript source.")
			{
                tokenEnpointOption,
				pathOption,
                dymMessageOption,
                noneOfTheseMessageOption,
                verboseOption,
                logOption,
            };
            var convertChatFile = new Command("convertChatFile", "Convert a simple .chat file into a .json file.")
            {
                pathOption,
                outputFileOption,
                logOption
            };

            var maxAttempts = new Option<int>(
                name: "--maxAttempts",
                description: "The number of messages to be sent to the Bot."
            );
            maxAttempts.IsRequired = true;

            var testScaleCommand = new Command("testScale", "Execute a scale testing sending messages to the Bot and ensure that the bot receives them successfully.")
            {
                tokenEnpointOption,
				maxAttempts,
                pathOption,
                dymMessageOption,
                noneOfTheseMessageOption,
                verboseOption,
                logOption
            };

			var intervalOption = new Option<Interval?>(
			   name: "--interval",
			   description: "The interval range to be used to get data from Dataverse."
			);
			intervalOption.IsRequired = true;
            intervalOption.AddValidator(option => {
                if (!Enum.TryParse(option.Tokens[0].Value, out Interval value))
                {
                    option.ErrorMessage = "Option '--interval' should be \"LastNTranscripts\", \"LastNDays\" or \"LastNWeeks\".";
                }
            });

            var valueOption = new Option<int>(
				name: "--value",
				description: "The number of transcripts, days or weeks to be obtained."
			);
			valueOption.IsRequired = true;
            valueOption.AddValidator(option => {
                if (option.GetValueForOption(valueOption) < 1)
                {
                    option.ErrorMessage = "Option '--value' should be at least 1 and cannot be negative.";
                }
            });

            var interactiveOption = new Option<bool>(
                name: "--interactive",
                description: "Defines whether to use the interactive login."
            );
            interactiveOption.SetDefaultValue(false);
            interactiveOption.AddValidator(result =>
            {
                if (!result.GetValueForOption(interactiveOption) &&
                    string.IsNullOrEmpty(result.GetValueForOption(clientSecretOption)))
                {
                    result.ErrorMessage = "Option '--clientSecret' is required for non-interactive login.";
                }
            });

            var getFromDVCommand = new Command("getFromDV", "Download chat transcripts from Dataverse.")
			{
                clientIdOption,
                clientSecretOption,
                environmentUrlOption,
                tenantIdOption,
				intervalOption,
				valueOption,
				interactiveOption,
				pathOption,
				verboseOption,
                botIdOption
			};

			command.AddCommand(testCommand);
            command.AddCommand(testScaleCommand);
            command.AddCommand(getFromDVCommand);
			command.AddCommand(convertChatFile);

            testCommand.SetHandler(async (tokenEndpoint, path, verbose, log) =>
            {
                var regionalEndpoint = await RegionalEndpointHelper.GetEndpointAsync(new Uri(tokenEndpoint));
                var options = new DirectLineOptions(tokenEndpoint, regionalEndpoint);
                var logger = new LoggerConfiguration()
                    .MinimumLevel.Debug()
                    .WriteTo.Console(outputTemplate: "{Message}{NewLine}")
                    .WriteTo.Conditional(logEvent => log, writeTo => writeTo.File($"log_{DateTime.Now.ToString("yyyyMMdd")}.txt"))
                    .CreateLogger();

                using (var directLineClient = new DirectLineClient(options))
                {
                    var runner = new Runner(logger, directLineClient, new FileHandler());
                    var result = await runner.RunTranscriptTestAsync(options, path, verbose);
                    Environment.Exit(result ? 0 : 1);
                }
            }, tokenEnpointOption, pathOption, verboseOption, logOption);

			getFromDVCommand.SetHandler(async (dataverseOptions, interval, value, interactive, path, verbose) =>
            {
                var result = false;
                using (var httpClient = new HttpClient())
                {
                    var dvOptions = new DataverseOptions()
                    {
                        ClientId = dataverseOptions.ClientId,
                        ClientSecret = dataverseOptions.ClientSecret,
                        EnvironmentUrl = dataverseOptions.EnvironmentUrl,
                        TenantId = dataverseOptions.TenantId,
                        BotId = dataverseOptions.BotId
                    };

                    var dvclient = new DataverseConnector(dvOptions, httpClient, new FileHandler());
                    var uri = dataverseOptions.EnvironmentUrl;
                    var currDate = DateTime.Now.Date;
                    var prevDate = DateTime.Now.Date;

                    switch (interval)
                    {
                        case Interval.LastNTranscripts:
                            uri += $"/api/data/v9.2/conversationtranscripts?$top={value}&$filter=_bot_conversationtranscriptid_value%20eq%20{dataverseOptions.BotId}";
                            break;
                        case Interval.LastNDays:
                            prevDate = prevDate.AddDays(-value);
                            uri += $"/api/data/v9.2/conversationtranscripts?$filter=createdon%20ge%20{prevDate.ToString("yyyy-MM-dd")}%20and%20createdon%20le%20{currDate.ToString("yyyy-MM-dd")}%20and%20_bot_conversationtranscriptid_value%20eq%20{dataverseOptions.BotId}";
                            break;
                        case Interval.LastNWeeks:
                            prevDate = prevDate.AddDays(-(value * 7));
                            uri += $"/api/data/v9.2/conversationtranscripts?$filter=createdon%20ge%20{prevDate.ToString("yyyy-MM-dd")}%20and%20createdon%20le%20{currDate.ToString("yyyy-MM-dd")}%20and%20_bot_conversationtranscriptid_value%20eq%20{dataverseOptions.BotId}";
                            break;
                    }

                    result = await dvclient.GetJsonFromDataverseAsync(uri, interactive, path);
                };
                Environment.Exit(result ? 0 : 1);
            }, new DataverseOptionsBinder(clientIdOption, clientSecretOption, environmentUrlOption, tenantIdOption, botIdOption), intervalOption, valueOption, interactiveOption, pathOption, verboseOption);

			testScaleCommand.SetHandler(async (tokenEndpoint, maxAttempts, path, verbose, log) =>
			{
                var regionalEndpoint = await RegionalEndpointHelper.GetEndpointAsync(new Uri(tokenEndpoint));
                var options = new DirectLineOptions(tokenEndpoint, regionalEndpoint);
                var logger = new LoggerConfiguration()
                    .MinimumLevel.Debug()
                    .WriteTo.Console(outputTemplate: "{Message}{NewLine}")
                    .WriteTo.Conditional(logEvent => log, writeTo => writeTo.File($"log_{DateTime.Now.ToString("yyyyMMdd")}.txt"))
                    .CreateLogger();

                using (var directLineClient = new DirectLineClient(options))
                {
                    var runner = new Runner(logger, directLineClient, new FileHandler());
                    var result = await runner.RunScaleTestAsync(options, maxAttempts, path, verbose);
                    Environment.Exit(result ? 0 : 1);
                }
            }, tokenEnpointOption, maxAttempts, pathOption, verboseOption, logOption);

            convertChatFile.SetHandler((path, outputFile, log) =>
			{
                var logger = new LoggerConfiguration()
                    .MinimumLevel.Debug()
                    .WriteTo.Console(outputTemplate: "{Message}{NewLine}")
                    .WriteTo.Conditional(logEvent => log, writeTo => writeTo.File($"log_{DateTime.Now.ToString("yyyyMMdd")}.txt"))
                    .CreateLogger();
                var runner = new Runner(logger, new FileHandler());
				var result = runner.ConvertChatFileToJSON(path, outputFile);
                
                Environment.Exit(result ? 0 : 1);
            }, pathOption, outputFileOption, logOption);

            return command.InvokeAsync(args);
		}
    }
}