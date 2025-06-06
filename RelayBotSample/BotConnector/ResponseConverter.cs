// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

using Microsoft.Bot.Builder;
using Microsoft.Bot.Schema;
using System.Collections.Generic;
using System.Linq;
using DirectLine = Microsoft.Bot.Connector.DirectLine;

namespace Microsoft.PowerVirtualAgents.Samples.RelayBotSample
{
    /// <summary>
    /// Class for converting Power Virtual Agents bot replied Direct Line Activity responses to standard Bot Schema activities
    /// You can add customized response converting/parsing logic in this class
    /// </summary>
    public class ResponseConverter
    {
        /// <summary>
        /// Convert single DirectLine activity into IMessageActivity instance
        /// </summary>
        /// <returns>IMessageActivity object as a message in a conversation</returns>
        /// <param name="directLineActivity">directline activity</param>
        public IMessageActivity ConvertToBotSchemaActivity(DirectLine.Activity directLineActivity)
        {
            if (directLineActivity == null)
            {
                return null;
            }

            var dlAttachments = directLineActivity.Attachments;
            if (dlAttachments != null && dlAttachments.Count() > 0)
            {
                return ConvertToAttachmentActivity(directLineActivity);
            }

            if (directLineActivity.SuggestedActions != null)
            {
                return ConvertToSuggestedActionsAcitivity(directLineActivity);
            }

            if (!string.IsNullOrEmpty(directLineActivity.Text))
            {
                return MessageFactory.Text(directLineActivity.Text);
            }

            return null;
        }

        /// <summary>
        /// Convert a list of DirectLine activities into list of IMessageActivity instances
        /// </summary>
        /// <returns>list of IMessageActivity objects as response messages in a conversation</returns>
        /// <param name="directLineActivities">list of directline activities</param>
        public IList<IMessageActivity> ConvertToBotSchemaActivities(List<DirectLine.Activity> directLineActivities)
        {
            return (directLineActivities == null || directLineActivities.Count() == 0) ?
                new List<IMessageActivity>() :
                directLineActivities
                    .Select(directLineActivity => ConvertToBotSchemaActivity(directLineActivity))
                    .ToList();
        }

        private IMessageActivity ConvertToAttachmentActivity(DirectLine.Activity directLineActivity)
        {
            var botSchemaAttachments = directLineActivity.Attachments.Select(
                    directLineAttachment => new Attachment()
                    {
                        ContentType = directLineAttachment.ContentType,
                        ContentUrl = directLineAttachment.ContentUrl,
                        Content = directLineAttachment.Content,
                        Name = directLineAttachment.Name,
                        ThumbnailUrl = directLineAttachment.ThumbnailUrl,
                    }).ToList();

            return MessageFactory.Attachment(
                botSchemaAttachments,
                text: directLineActivity.Text,
                ssml: directLineActivity.Speak,
                inputHint: directLineActivity.InputHint);
        }

        private IMessageActivity ConvertToSuggestedActionsAcitivity(DirectLine.Activity directLineActivity)
        {
            var directLineSuggestedActions = directLineActivity.SuggestedActions;
            return MessageFactory.SuggestedActions(
                actions: directLineSuggestedActions.Actions?.Select(action => action.Title).ToList(),
                text: directLineActivity.Text,
                ssml: directLineActivity.Speak,
                inputHint: directLineActivity.InputHint);
        }
    }
}
