// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

using System.Threading;
using System.Threading.Tasks;
using Microsoft.Bot.Builder;
using Microsoft.Bot.Schema;
using Newtonsoft.Json;

namespace DecryptSkillBot.Bots
{
    public class DecryptBot : ActivityHandler
    {
        protected override async Task OnMessageActivityAsync(ITurnContext<IMessageActivity> turnContext, CancellationToken cancellationToken)
        {

            // Initial message - you can remove this, it's to show the skill is running
            var messageText = "Looking up your details...";
            await turnContext.SendActivityAsync(MessageFactory.Text(messageText, messageText, InputHints.ExpectingInput), cancellationToken);

            // Load token from input
            var activity = turnContext.Activity;
            var tokenEncrypted = new TokenEncrypted();
            if (activity.Value != null)
            {
                tokenEncrypted = JsonConvert.DeserializeObject<TokenEncrypted>(JsonConvert.SerializeObject(activity.Value));
            }        

            // this is the variable for the object you return back to PVA
            var userId = new UserId();

            if (tokenEncrypted.token != null)
            {
                // Decrypyt your token value here
                // Call class to decrypt with your public key here
                // Set the UserId value based on the value decryption provides, remove the line below
                userId.Id = DecryptToken.GetUserID(tokenEncrypted);
            }

            // The code below sets the resultValue and ends the conversation with the skill
            var endActivity = new Activity();
            endActivity.Type = ActivityTypes.EndOfConversation;
            endActivity.Value = userId;

            endActivity.Code = EndOfConversationCodes.CompletedSuccessfully;
            await turnContext.SendActivityAsync(endActivity, cancellationToken);
        }

        protected override Task OnEndOfConversationActivityAsync(ITurnContext<IEndOfConversationActivity> turnContext, CancellationToken cancellationToken)
        {
            // This will be called if the root bot is ending the conversation.  Sending additional messages should be
            // avoided as the conversation may have been deleted.
            // Perform cleanup of resources if needed.
            return Task.CompletedTask;
        }
}
