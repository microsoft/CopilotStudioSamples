﻿// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
//
// Generated with Bot Builder V4 SDK Template for Visual Studio CoreBot v4.16.0

using Microsoft.Bot.Builder;
using Microsoft.Bot.Builder.Integration.AspNet.Core;
using Microsoft.Bot.Builder.TraceExtensions;
using Microsoft.Bot.Connector.Authentication;
using Microsoft.Extensions.Logging;
using System;
using TranslationBot.Translation;

namespace TranslationBot
{
    public class AdapterWithErrorHandler : CloudAdapter
    {
        public AdapterWithErrorHandler(TranslationMiddleware translationMiddleware, BotFrameworkAuthentication auth, ILogger<IBotFrameworkHttpAdapter> logger, ConversationState conversationState = default)
            : base(auth, logger)
        {
            Use(translationMiddleware);

            OnTurnError = async (turnContext, exception) =>
            {
                // Log any leaked exception from the application.
                logger.LogError(exception, $"[OnTurnError] unhandled error : {exception.Message}");

                // Send a message to the user
                await turnContext.SendActivityAsync("The bot encountered an error or bug.");
                await turnContext.SendActivityAsync("To continue to run this bot, please fix the bot source code.");

                if (conversationState != null)
                {
                    try
                    {
                        await conversationState.DeleteAsync(turnContext);
                    }
                    catch (Exception ex)
                    {
                        logger.LogError(exception, $"Exception caught on attempting to Delete ConversationState: {ex.Message}");
                    }
                }

                // Send a trace activity, which will be displayed in the Bot Framework Emulator
                await turnContext.TraceActivityAsync("OnTurnError Trace", exception.Message, "https://www.botframework.com/schemas/error", "TurnError");
            };
        }
    }
}
