# Sample code for adding non-AAD SSO support to Power Virtual Agents

## This solution shows how to add a Azure Bot Framework skill that supports token validation within Power Virtual Agents, effectively achieving single sign-on.
## This code and solution design is for guidance only.

## Solution design
This solution has a number of elements:

1. A user client (e.g. a browser)
2. A website that already has user sign-in
3. An authentication provider - e.g using OAuth 2
4. A web service endpoint running under the same domain as 2, that receives an authentication token and generates a signed payload for the user's client
5. A Power Virtual Agent
6. An Azure Bot Service Instance running code developed using the Azure Bot Framework
7. A private/public key

The solution flow is as follows:
1. The user browses to the secured section of the website
2. The website prompts the user to sign in, generating a token for the user.
3. Once returned to the website, the client passes their authentication token to the web service. The web service reads claims from the token that identify the user (i.e. an ID or email).
4. The web service signs a unique identifer, plus a timestamp/expiry with their private key, and returns this new signed payload to the client to store.
5. When the user reaches the page with the PVA bot, the signed payload is passed in to the PVA bot using Javascript.
6. When the PVA bot needs to know the user's identity, the Bot Framework skill is called. It uses the public key to decrypt the signed payload. If it is new enough it responds with the user's unique identifier.
7. PVA can then use the identifier to look up any appropriate information for the user.

# Setup

## Create an Azure Bot Service to run your skill
https://docs.microsoft.com/en-us/azure/bot-service/abs-quickstart?view=azure-bot-service-4.0
https://microsoft.github.io/botframework-solutions/index#tutorials

1. We need to deploy our BF skill to a Azure Bot Service.
2. Record the URL that you have deployed to, and ensure as part of the creation process that you create an AAD app ID and client secret.

## Deploy DecryptSkillBot to your Bot Service
https://docs.microsoft.com/en-us/azure/bot-service/skills-conceptual?view=azure-bot-service-4.0
https://docs.microsoft.com/en-us/azure/bot-service/bot-builder-deploy-az-cli?view=azure-bot-service-4.0&tabs=csharp
https://docs.microsoft.com/en-us/power-virtual-agents/configuration-add-skills

1. Set your App ID and client secret in appsettings.json.
2. Set your allowed caller id to the id of your PVA bot - get this from the skills - 'Provide ID for allow list' button in the PVA UI.
3. Update wwwroot/manifest/DecryptionSkill.json with the URL of your new Azure Bot Service. The manifest is the document that describes the interface of your skill, and will be used by PVA.
4. Publish your Bot to the App Service running your Azure Bot Service.

## Import your skill to PVA
https://docs.microsoft.com/en-us/power-virtual-agents/configuration-add-skills

1. Browse to the Skills menu in PVA
2. Import your new skill by pasting in the URL of your skills manifest (BotURL/manifest/DecryptionSKill.json)
3. Create a new user topic - based on SSOPVAFlow.png (Trigger word not necessary)
4. Ensure that the 'tokenValue' variable is set to be a global variable that external sources can set.
5. Ensure that the ID variable that comes back from the skill, is also set as global (but not external). Use this variable in other topics to trigger authentication.
6. Add Power Automate flows to get any other user data you need based on the ID.

## Test from a client
1. Edit 'testbotembedded.html' in the ClientWebApp solution
2. Ensure the BOT_ID variable is set to the ID of your PVA bot (get this from the publish menu in PVA)
3. Open the html file in a browser. Your bot should load in.
4. Type the trigger phrase of the your new topic to start the authentication in the skill

That's the basics of the SSO solution!

# Tasks to finish
1. Write decryption Logic into the skill. Start from Bots/DecryptBot.cs in the DecryptSkillBot solution. Ensure to use you public key, and check the date stamp on the incoming token.
2. Embed the javascript in testbotembedded.html in the page that hosts your PVA bot. This code replaces any iFrame you have used to render the bot.
3. Edit the javascript to retrieve the encrypted token from the local browser.
4. Write the web service operation to sign the user ID with a private key (if the user has a valid authentication token).







