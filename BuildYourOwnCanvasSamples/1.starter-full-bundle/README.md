# Description

In this demo, we will show how to connect a custom canvas to directly send messages and recieve dynamic responses like Adaptive Cards, Carousels, etc. and custom rendor them from the Power Virtual Agents. 

> IMPORTANT: When dealing with personal data, please respect user privacy. Follow platform guidelines and post your privacy statement online.

# How to run locally

This demo integrates with multiple services. There are multiple services you need to setup in order to host the demo.

1. [Clone the code](#clone-the-code)
1. [Setup Power Virtual Agent And Direct Line](#setup-power-virtual-agent-and-direct-line)
1. [Prepare and run the code](#prepare-and-run-the-code)

## Clone the code

To host this demo, you will need to clone the code and run locally.

1. Clone this repository
1. Create one empty file for environment variables `/web/.env`


## Setup Power Virtual Agent And Direct Line
1. Create your Power VA bot through the Dynamics Bot Designer portal: `https://va.ai.dynamics.com/#/`
1. Click on Manage > Channels within the Sidebar
1. Click on Demo Website and Copy the bot Url to your clipboard.

1. Retreive the botid and bottenentid from the url, you will need to place these within `/web/.env`
      -  `BOT_ID=<your_bot_id>`  
      -  `BOT_TENANT_ID=<your_bot_tenant_id>`    


## Prepare and run the code

1. Under `web` folder, run the following
   1. `npm install`
   1. `npm start`
1. Browse to http://localhost:5000/ to start the demo


# Code

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

### `/web/.env`

```
BOT_ID=21wejwl2-2j34-dse3-12df-1123rgted34
BOT_TENANT_ID=3fde45d-32we-3342-ewer-err3fr32564
```


# Further reading

-  [Power Virtual Agents Documentation and Resources](https://docs.microsoft.com/en-us/power-virtual-agents/overview)
-  [Generating a Direct Line token](https://docs.microsoft.com/en-us/azure/bot-service/rest-api/bot-framework-rest-direct-line-3-0-authentication?view=azure-bot-service-4.0#generate-token)
-  [Enhanced Direct Line Authentication feature](https://blog.botframework.com/2018/09/25/enhanced-direct-line-authentication-features/)
-  [Microsoft Flow Documentation and Resources](https://docs.microsoft.com/en-us/flow/)
