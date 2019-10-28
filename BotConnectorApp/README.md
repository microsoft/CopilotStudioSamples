# Bot Connector

This console app shows the minimum code required to connect customized client to an existing virtual agent.

## Prerequisites

- [.NET Core SDK](https://dotnet.microsoft.com/download) version 2.1

  ```powershell
  # determine dotnet version
  dotnet --version
  ```

## To try this sample
- Update following settings in `BotConnectorApp\App.config`

  1) Set value for `BotName` to name of the bot to connect
  2) Update `BotId` and `BotTenantId` as follows:

     To retrieve your bot's bot ID and tenant ID, click on left side pane's ***Manage***, click ***Channels*** and click on the Azure Bot Service channel that you need to connect to.
    Copy and save the bot ID and tenant ID value by clicking Copy.

  3) Update `EndConversationMessage` if needed

-  Run `BotConnectorApp` from a terminal

    ```
    # change into project folder
    cd BotConnectorApp

    # run the bot
    dotnet run
    ```

- Run `BotConnectorApp` from Visual Studio

  1) Launch Visual Studio
  2) File -> Open -> Project/Solution
  3) Navigate to `BotConnectorApp` folder and select `BotConnectorApp.csproj` file
  4) Press `F5` to run the project

## Further reading
- [Power Virtual Agents Bot](https://www.bing.com) ***to be updated once formal doc url determined**
- [Power Virtual Agents - connect bot to custom application](https://www.bing.com) ***to be updated once formal doc url determined**