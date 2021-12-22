# Relay Bot
Relay bot is a legacy construct to integrate with a power virtual agent bot.
To integrate with your power virtual agent bot we now support power virtual agent bot as a skill,
please go through this [documentation](https://docs.microsoft.com/en-us/power-virtual-agents/advanced-use-pva-as-a-skill).

If you are trying to enable speech with your power virtual agent bot, you have the following options today:  
* Create a [bot](https://docs.microsoft.com/en-us/composer/quickstart-create-bot-with-azure) and enable [Direct Line speech](https://docs.microsoft.com/en-us/azure/bot-service/bot-service-channel-connect-directlinespeech?view=azure-bot-service-4.0) as a channel for that bot and connect to it to power virtual agent bot as a skill.
* Bring your own [custom canvas](https://github.com/microsoft/BotFramework-WebChat/tree/main/samples/03.speech/b.cognitive-speech-services-js) that enables speech services on the client side and [connect](https://docs.microsoft.com/en-us/power-virtual-agents/customize-default-canvas) it to the your power virtual agent bot. 
