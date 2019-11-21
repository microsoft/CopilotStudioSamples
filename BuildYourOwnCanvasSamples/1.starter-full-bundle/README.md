# Description

In this demo, we will show how to connect a custom canvas to directly send messages and recieve dynamic responses like Adaptive Cards, Carousels, etc. and custom rendor them from the Power Virtual Agents. 

> IMPORTANT: When dealing with personal data, please respect user privacy. Follow platform guidelines and post your privacy statement online.

# How to run locally

This demo integrates with multiple services. There are multiple services you need to setup in order to host the demo.

1. [Clone the code](#clone-the-code)
1. [Setup Azure Bot Services](#setup-azure-bot-services)
1. [Setup Power Virtual Agent And Direct Line](#setup-power-virtual-agent-and-direct-line)
1. [Prepare and run the code](#prepare-and-run-the-code)

## Clone the code

To host this demo, you will need to clone the code and run locally.

1. Clone this repository
1. Create two empty files for environment variables, `/bot/.env` and `/web/.env`

## Setup Azure Bot Services

> We prefer to use [Bot Channel Registration](https://ms.portal.azure.com/#create/Microsoft.BotServiceConnectivityGalleryPackage) during development. This will help you diagnose problems locally without deploying to the server and speed up development.

You can follow our instructions on how to [setup a new Bot Channel Registration](https://docs.microsoft.com/en-us/azure/bot-service/bot-service-quickstart-registration?view=azure-bot-service-3.0).

1. Save the Microsoft App ID and password to `/bot/.env`
   -  `MICROSOFT_APP_ID=12345678-1234-5678-abcd-12345678abcd`
   -  `MICROSOFT_APP_PASSWORD=a1b2c3d4e5f6`

> When you are building your production bot, never expose your Web Chat or Direct Line secret to the client. Instead, you should use the secret to generate a limited token and send it to the client. For information, please refer the documentation on [Direct Line token generation](https://docs.microsoft.com/en-us/azure/bot-service/rest-api/bot-framework-rest-direct-line-3-0-authentication?view=azure-bot-service-4.0#generate-token) and the [Enhanced Direct Line Authentication feature](https://blog.botframework.com/2018/09/25/enhanced-direct-line-authentication-features/).

During development, you will run your bot locally. Azure Bot Services will send activities to your bot thru a public URL. You can use [ngrok](https://ngrok.com/) to expose your bot server on a public URL.

1. Run `ngrok http -host-header=localhost:3978 3978`
1. Update your Bot Channel Registration. You can use [Azure CLI](https://aka.ms/az-cli) or [Azure Portal](https://portal.azure.com)
   -  Via Azure CLI
      -  Run `az bot update --resource-group <your-bot-rg> --name <your-bot-name> --subscription <your-subscription-id> --endpoint "https://a1b2c3d4.ngrok.io/api/messages"`
   -  Via Azure Portal
      -  Browse to your Bot Channel Registration
      -  Select "Settings"
      -  In "Configuration" section, set "Messaging Endpoint" to `https://a1b2c3d4.ngrok.io/api/messages`

## Setup Power Virtual Agent And Direct Line
1. Create your Power VA bot through the Dynamics Bot Designer portal: `https://va.ai.dynamics.com/#/`
1. Click on Manage > Channels within the Sidebar
1. Click on Demo Website and Copy the bot Url to your clipboard.

1. Retreive the botid and bottenentid from the url, you will need to place these within `/bot/.env`
      -  `BOT_ID=<your_bot_id>`  
      -  `BOT_TENANT_ID=<your_bot_tenant_id>`    


## Prepare and run the code

1. Under each of `bot`, and `web` folder, run the following
   1. `npm install`
   1. `npm start`
1. Browse to http://localhost:5000/ to start the demo


# Code

-  `/bot/` is the bot server
-  `/web/` is the REST API for distributing Direct Line tokens
   -  `GET /api/directline/token` will generate a new Direct Line token for the React app
   -  During development-time, it will also serve the bot server via `/api/messages/`
      -  To enable this feature, add `PROXY_BOT_URL=http://localhost:3978` to `/web/.env`

# Overview

This sample includes multiple parts:

-  A basic web page with Web Chat integrated via JavaScript bundle
-  A Restify web server for distributing tokens
   -  A REST API that generate Direct Line token for new conversations
-  Connection to the Power Virtual Agents allowing for dynamic responses based off of configuration.


## Content of the `.env` files

The `.env` file hold the environment variable critical to run the service. These are usually security-sensitive information and must not be committed to version control. Although we recommend to keep them in [Azure Key Vault](https://azure.microsoft.com/en-us/services/key-vault/), for simplicity of this sample, we would keep them in `.env` files.

To ease the setup of this sample, here is the template of `.env` files.

### `/bot/.env`

```
MICROSOFT_APP_ID=12345678-1234-5678-abcd-12345678abcd
MICROSOFT_APP_PASSWORD=a1b2c3d4e5f6
```

### `/web/.env`

```
BOT_ID=21wejwl2-2j34-dse3-12df-1123rgted34
BOT_TENANT_ID=3fde45d-32we-3342-ewer-err3fr32564
```


# Further reading

-  [Power Virtual Agents Documentation and Resources](https://docs.microsoft.com/en-us/power-virtual-agents/overview)
-  [Setting up a new Bot Channel Registration](https://docs.microsoft.com/en-us/azure/bot-service/bot-service-quickstart-registration?view=azure-bot-service-3.0)
-  [Generating a Direct Line token](https://docs.microsoft.com/en-us/azure/bot-service/rest-api/bot-framework-rest-direct-line-3-0-authentication?view=azure-bot-service-4.0#generate-token)
-  [Enhanced Direct Line Authentication feature](https://blog.botframework.com/2018/09/25/enhanced-direct-line-authentication-features/)
-  [Microsoft Flow Documentation and Resources](https://docs.microsoft.com/en-us/flow/)
