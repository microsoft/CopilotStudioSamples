// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

using System;
using System.Collections.Generic;
using System.Diagnostics.Metrics;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Bot.Builder;
using Microsoft.Bot.Connector.DirectLine;
using Microsoft.Bot;
using Microsoft.Extensions.Configuration;
using Microsoft.Translation.Helpers;
using Newtonsoft.Json;
using TranslationBot.Translation.Helpers;
using Microsoft.Bot.Connector;
using TranslationBot.Translation.Model;

namespace TranslationBot.Translation
{
    /// <summary>
    /// Middleware for translating text between the user and bot.
    /// Uses the Microsoft Translator Text API.
    /// </summary>
    public class TranslationMiddleware : IMiddleware
    {
        private readonly TranslatorService _translator;
        private readonly TokenService _tokenService;
        private readonly DirectLineService _directLineService;
        private readonly bool _detectLanguageOnce;
        private readonly bool _getLanguageFromUri;
        private readonly string _pvaTopicExceptionTag;
        private readonly string _botLanguage;
        private readonly List<string> _escalationPhrases;
        private readonly UserLanguage _languages;
        private IStatePropertyAccessor<string> _stateLanguage;
        private IStatePropertyAccessor<bool> _nextTurnExcepted;
        private IStatePropertyAccessor<string> _conversationId;
        private IStatePropertyAccessor<string> _token;
        private IStatePropertyAccessor<string> _watermark;
        private readonly ConversationState _conversationState;

        /// <summary>
        /// Initializes a new instance of the <see cref="TranslationMiddleware"/> class.
        /// </summary>
        public TranslationMiddleware(TranslatorService translator, IConfiguration configuration, UserLanguage languages, ConversationState conversationState, TokenService tokenService, DirectLineService directLineService)
        {
            _detectLanguageOnce = Convert.ToBoolean(configuration["DetectLanguageOnce"]);
            _getLanguageFromUri = Convert.ToBoolean(configuration["GetLanguageFromUri"]);
            _botLanguage = configuration["BotLanguage"];
            _pvaTopicExceptionTag = configuration["PVATopicExceptionTag"];
            _translator = translator ?? throw new ArgumentNullException(nameof(translator));
            _stateLanguage = conversationState.CreateProperty<string>("UserLanguage");
            _nextTurnExcepted = conversationState.CreateProperty<bool>("NextTurnExcepted");
            _conversationId = conversationState.CreateProperty<string>("ConversationId");
            _token = conversationState.CreateProperty<string>("Token");
            _watermark = conversationState.CreateProperty<string>("Watermark");
            _escalationPhrases = configuration.GetSection("EscalationPhrases").Get<List<string>>();
            _languages = languages ?? throw new ArgumentNullException(nameof(languages));
            _conversationState = conversationState ?? throw new NullReferenceException(nameof(conversationState));
            _tokenService = tokenService ?? throw new ArgumentNullException(nameof(tokenService));
            _directLineService = directLineService ?? throw new ArgumentNullException(nameof(directLineService));
        }

        /// <summary>
        /// Processes an incoming activity.
        /// </summary>
        /// <param name="turnContext">Context object containing information for a single turn of conversation with a user.</param>
        /// <param name="next">The delegate to call to continue the bot middleware pipeline.</param>
        /// <param name="cancellationToken">A cancellation token that can be used by other objects or threads to receive notice of cancellation.</param>
        /// <returns>A <see cref="Task"/> representing the asynchronous operation.</returns>
        public async Task OnTurnAsync(ITurnContext turnContext, NextDelegate next, CancellationToken cancellationToken = default(CancellationToken))
        {
            var language = string.Empty;
            var nextTurnExcepted = await _nextTurnExcepted.GetAsync(turnContext, () => false, cancellationToken);
            var token = await _token.GetAsync(turnContext, () => String.Empty, cancellationToken);
            var conversationId = await _conversationId.GetAsync(turnContext, () => String.Empty, cancellationToken);
            var watermark = await _watermark.GetAsync(turnContext, () => null, cancellationToken);

            if (turnContext == null)
            {
                throw new ArgumentNullException(nameof(turnContext));
            }

            // Check if message is not an Omnichannel control data
            if (turnContext.Activity.ChannelData != null && TranslationSettings.OcControlTag.Any(phrase => turnContext.Activity.ChannelData.ToString().Contains(phrase, StringComparison.OrdinalIgnoreCase)))
                return;

            if (turnContext.Activity.Type == ActivityTypes.Message)
            {
                var urlLanguage = _languages.Get(TranslationSettings.DefaultDictionaryKey);
                var userlanguage = await _stateLanguage.GetAsync(turnContext, () => string.Empty, cancellationToken);

                // Detect the user language if not already identified
                if ((_detectLanguageOnce && string.IsNullOrEmpty(userlanguage)) && !_getLanguageFromUri || !_detectLanguageOnce)
                {
                    language = await _translator.DetectAsync(turnContext.Activity.Text, cancellationToken);
                }
                else if ((_getLanguageFromUri && string.IsNullOrEmpty(userlanguage)) && !string.IsNullOrEmpty(urlLanguage))
                {
                    language = urlLanguage;
                }
                else
                {
                    language = userlanguage;
                }

                // Check the flag and avoid the translation
                if (!nextTurnExcepted && !string.IsNullOrEmpty(turnContext.Activity.Text))
                {
                    turnContext.Activity.Text = await _translator.TranslateAsync(turnContext.Activity.Text, cancellationToken, language, _botLanguage);
                }
                else
                {
                    await _nextTurnExcepted.SetAsync(turnContext, false, cancellationToken);
                }

                if (string.IsNullOrEmpty(token))
                {
                    token = await _tokenService.GetTokenAsync();
                    await _token.SetAsync(turnContext, token, cancellationToken);
                }

                if (string.IsNullOrEmpty(conversationId))
                {
                    conversationId = await _directLineService.StartConversation(token);
                    await _conversationId.SetAsync(turnContext, conversationId, cancellationToken);
                }

                // Post the user message and get the bot responses
                var response = await _directLineService.PostUserMessage(
                    new Activity()
                    {
                        Type = turnContext.Activity.Type,
                        From = new ChannelAccount { Id = turnContext.Activity.From.Id, Name = turnContext.Activity.From.Name },
                        Text = turnContext.Activity.Text,
                        Value = turnContext.Activity.Value,
                        TextFormat = turnContext.Activity.TextFormat,
                        Locale = turnContext.Activity.Locale,
                    },
                    token,
                    conversationId,
                    watermark);

                await _watermark.SetAsync(turnContext, response.Watermark, cancellationToken);

                foreach (var activity in response.Activities)
                {
                    // Re-create the DirectLine actvity to Bot.Schema.Activity
                    var replyActivity = CreateActivity(activity);

                    if (turnContext.Activity.ChannelId.Equals(TranslationSettings.OcChannelId, StringComparison.OrdinalIgnoreCase))
                    {
                        if (_escalationPhrases.Any(phrase => !string.IsNullOrEmpty(replyActivity.Text) && replyActivity.Text.Contains(phrase, StringComparison.OrdinalIgnoreCase)))
                        {
                            // Escalates the conversation to an agent
                            Dictionary<string, object> contextVars = new Dictionary<string, object>() { { "HandOffPhrase", replyActivity.Text } };
                            OmnichannelBotClient.AddEscalationContext(replyActivity, contextVars);
                        }
                        else
                        {
                            // Bridge the bot message for Omnichannel support
                            OmnichannelBotClient.BridgeBotMessage(replyActivity);
                        }
                    }

                    if (!string.IsNullOrEmpty(replyActivity.Text) && replyActivity.Text.Equals(_pvaTopicExceptionTag, StringComparison.OrdinalIgnoreCase))
                    {
                        await _nextTurnExcepted.SetAsync(turnContext, true, cancellationToken);
                    }
                    else
                    {
                        await TranslateMessageActivityAsync(replyActivity, language, cancellationToken);
                        await turnContext.SendActivityAsync(replyActivity, cancellationToken);
                    }
                }

                await _stateLanguage.SetAsync(turnContext, language, cancellationToken);
                await _conversationState.SaveChangesAsync(turnContext, false, cancellationToken);
            }
            
            await next(cancellationToken).ConfigureAwait(false);
        }

        /// <summary>
        /// Translates the activity message
        /// </summary>
        /// <param name="activity">Activity object.</param>
        /// <param name="language">Target language.</param>
        /// <param name="cancellationToken">A cancellation token that can be used by other objects or threads to receive notice of cancellation.</param>
        /// <returns>A <see cref="Task"/> representing the asynchronous operation.</returns>
        private async Task TranslateMessageActivityAsync(Microsoft.Bot.Schema.Activity activity, string language, CancellationToken cancellationToken = default(CancellationToken))
        {
            if (activity.Type == ActivityTypes.Message)
            {
                if (activity.Text != null)
                {
                    activity.Text = await _translator.TranslateAsync(activity.Text, cancellationToken, _botLanguage, language);
                }

                if (activity.SuggestedActions != null)
                {
                    foreach (var action in activity.SuggestedActions.Actions)
                    {
                        action.Title = await _translator.TranslateAsync(action.Title, cancellationToken, _botLanguage, language);
                        action.Value = await _translator.TranslateAsync(action.Value.ToString(), cancellationToken, _botLanguage, language);
                    }
                }

                if (activity.Attachments != null)
                {
                    foreach (var attachment in activity.Attachments)
                    {
                        var stringContent = attachment.Content.ToString();
                        Regex regex = new Regex(@"(?<=\btext"": ""|title"": ""|value"": "")[^""]*");
                        var matches = regex.Matches(stringContent);
                        
                        foreach (var match in matches)
                        {
                            if (!string.IsNullOrEmpty(match.ToString()))
                            {
                                var translatedText = await _translator.TranslateAsync(match.ToString(), cancellationToken, _botLanguage, language);
                                stringContent = stringContent.Replace(match.ToString(), translatedText);
                            }
                        }

                        attachment.Content = JsonConvert.DeserializeObject(stringContent);
                    }
                }
            }
        }

        private Microsoft.Bot.Schema.Activity CreateActivity(Activity directlineActivity)
        {
            var activity = new Microsoft.Bot.Schema.Activity();

            activity.Type = directlineActivity.Type;
            activity.Id = directlineActivity.Id;
            activity.ServiceUrl = directlineActivity.ServiceUrl;
            activity.Timestamp = directlineActivity.Timestamp;
            activity.LocalTimestamp = directlineActivity.LocalTimestamp;
            activity.ChannelId = directlineActivity.ChannelId;
            activity.From = new Microsoft.Bot.Schema.ChannelAccount()
            {
                Id = directlineActivity.From.Id,
                Name = directlineActivity.From.Name
            };
            activity.Conversation = new Microsoft.Bot.Schema.ConversationAccount()
            {
                Name = directlineActivity.Conversation.Name,
                Id = directlineActivity.Conversation.Id,
                IsGroup = directlineActivity.Conversation.IsGroup
            };
            activity.Recipient = new Microsoft.Bot.Schema.ChannelAccount()
            {
                Id = directlineActivity.From.Id,
                Name = directlineActivity.From.Name
            };
            activity.ReplyToId = directlineActivity.ReplyToId;
            activity.ChannelData = directlineActivity.ChannelData;
            activity.Action = directlineActivity.Action;
            activity.Name = directlineActivity.Name;
            activity.AttachmentLayout = directlineActivity.AttachmentLayout;
            activity.Text = directlineActivity.Text;
            activity.TextFormat = directlineActivity.TextFormat;
            activity.HistoryDisclosed = directlineActivity.HistoryDisclosed;
            activity.InputHint = directlineActivity.InputHint;
            activity.Properties = directlineActivity.Properties;
            activity.Summary = directlineActivity.Summary;
            activity.TopicName = directlineActivity.TopicName;
            activity.Code = directlineActivity.Code;
            activity.Speak = directlineActivity.Speak;
            activity.Value = directlineActivity.Value;
            activity.Locale = directlineActivity.Locale;
            activity.InputHint = directlineActivity.InputHint;

            if (directlineActivity.MembersAdded != null)
            {
                var membersAdded = new List<Microsoft.Bot.Schema.ChannelAccount>();
                foreach (var memberAdded in directlineActivity.MembersAdded)
                {
                    membersAdded.Add(new Microsoft.Bot.Schema.ChannelAccount()
                    {
                        Id = memberAdded.Id, 
                        Name = memberAdded.Name
                    });
                }

                activity.MembersAdded = membersAdded;
            }

            if (directlineActivity.MembersRemoved != null)
            {
                var membersRemoved = new List<Microsoft.Bot.Schema.ChannelAccount>();
                foreach (var memberRemoved in directlineActivity.MembersRemoved)
                {
                    membersRemoved.Add(new Microsoft.Bot.Schema.ChannelAccount()
                    {
                        Id = memberRemoved.Id,
                        Name = memberRemoved.Name
                    });
                }

                activity.MembersRemoved = membersRemoved;
            }

            if (directlineActivity.Entities != null)
            {
                var entities = new List<Microsoft.Bot.Schema.Entity>();
                foreach (var entity in directlineActivity.Entities)
                {
                    entities.Add(new Microsoft.Bot.Schema.Entity()
                    {
                        Properties = entity.Properties,
                        Type = entity.Type
                    });
                }

                activity.Entities = entities;
            }

            if (directlineActivity.SuggestedActions != null)
            {
                var cards = new List<Microsoft.Bot.Schema.CardAction>();
                foreach (var card in directlineActivity.SuggestedActions.Actions)
                {
                    cards.Add(new Microsoft.Bot.Schema.CardAction()
                    {
                        Title = card.Title,
                        Value = card.Value,
                        Type = card.Type,
                        Image = card.Image
                    });
                }

                activity.SuggestedActions = new Microsoft.Bot.Schema.SuggestedActions() { Actions = cards };
            }

            if (directlineActivity.Attachments != null)
            {
                var attachments = new List<Microsoft.Bot.Schema.Attachment>();
                foreach (var attachment in directlineActivity.Attachments)
                {
                    attachments.Add(new Microsoft.Bot.Schema.Attachment()
                    {
                        Content = attachment.Content,
                        ContentUrl = attachment.ContentUrl,
                        Name = attachment.Name,
                        ContentType = attachment.ContentType,
                        ThumbnailUrl = attachment.ThumbnailUrl
                    });
                }

                activity.Attachments = attachments;
            }

            return activity;
        }
    }
}


