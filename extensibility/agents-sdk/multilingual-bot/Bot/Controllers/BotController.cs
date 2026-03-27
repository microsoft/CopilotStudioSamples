// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
//
// Generated with Bot Builder V4 SDK Template for Visual Studio EmptyBot v4.16.0

using Microsoft.AspNetCore.Mvc;
using Microsoft.Bot.Builder;
using Microsoft.Bot.Builder.Integration.AspNet.Core;
using System.Collections.Generic;
using System;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using TranslationBot.Translation.Helpers;

namespace TranslationBot.Controllers
{
    // This ASP Controller is created to handle a request. Dependency Injection will provide the Adapter and IBot
    // implementation at runtime. Multiple different IBot implementations running at different endpoints can be
    // achieved by specifying a more specific type for the bot constructor argument.
    
    [ApiController]
    public class BotController : ControllerBase
    {
        private readonly IBotFrameworkHttpAdapter _adapter;
        private readonly IBot _bot;
        private readonly ILogger<BotController> _logger;
        private readonly UserLanguage _languages;

        public BotController(IBotFrameworkHttpAdapter adapter, IBot bot, UserLanguage languages, ILogger<BotController> logger)
        {
            _adapter = adapter;
            _bot = bot;
            _languages = languages ?? throw new ArgumentNullException(nameof(languages));
            _logger = logger;
        }

        [HttpPost]
        [HttpGet]
        [Route("api/{route}/{language?}")]
        public async Task PostAsync(string route, string language)
        {
            if (string.IsNullOrEmpty(route))
            {
                _logger.LogError($"PostAsync: No route provided.");
                throw new ArgumentNullException(nameof(route));
            }
            if (!string.IsNullOrEmpty(language))
            {
                _languages.Save(language);
            }

            if (_adapter != null)
            {
                if (_logger.IsEnabled(LogLevel.Debug))
                {
                    _logger.LogInformation($"PostAsync: routed '{route}' to {_adapter}");
                }

                // Delegate the processing of the HTTP POST to the appropriate adapter.
                // The adapter will invoke the bot.
                await _adapter.ProcessAsync(Request, Response, _bot).ConfigureAwait(false);
            }
            else
            {
                _logger.LogError($"PostAsync: No adapter registered and enabled for route {route}.");
                throw new KeyNotFoundException($"No adapter registered and enabled for route {route}.");
            }
        }
    }
}
