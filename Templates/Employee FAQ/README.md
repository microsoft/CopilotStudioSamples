# Employee FAQ PVA Template

## Overview

Bots are great at helping your employees to self serve HR, IT or any other internal employee functions by providing automated responses and taking meaningful actions.  This increases employee's efficiency and saves your organization cost and time.  

Bots have limitations and when a bot can’t help, it needs a way to connect employee with human subject matter experts. The Employee FAQ bot template is built with [Power Virtual Agents](https://powervirtualagents.microsoft.com/) that comes with a built-in capability to log an employee’s escalation request, notify a human expert, and allow them to quickly respond to the employee - all within [Microsoft Teams](https://www.microsoft.com/microsoft-teams/group-chat-software). It also obtains employee feedback so you can make improvements to the bot over time.  Being built on top of Power Virtual Agents, it can be easily customized and extended to suit your needs with no develeper and data science background required. 

## Features

The template supports the following features:



#### Power Virtual Agents bot

- Lessons Topics to illustrate how to build topics for your bot in Power Virtual Agents
- Escalation requests (allow users to make requests with a **Title** and **Description** then post the request to a team in Microsoft Teams for human support with an adaptive card)
- Instant chat links from the request adaptive card to talk to the user that has made a request
- Resolve requests directly in team channel via the adaptive card
- Status (provide the status of requests for both **all** and **active** requests)
- Feedback (receive and display feedback to a teams channel with adaptive cards)



#### Power Automate flows

- Receives and stores information into Microsoft Dataverse database
- Posts adaptive cards to in to Microsoft Teams teams
- Receives information from adaptive cards



#### Power Apps - canvas app

- View and filter requests
- View and filter feedback



## License requirement

Employee FAQ template can be used with Office licenses that include Power Virtual Agents. Learn more about [Licensing for Power Virtual Agents for Teams]( https://docs.microsoft.com/power-virtual-agents/teams/requirements-licensing-teams). Easy way to check is if you can launch [Power Virtual Agents Teams app](https://aka.ms/PVAForTeams) in your Microsoft Teams client.

As you extend the bot beyond what is included in the template, you may be required to upgrade to a premium license. Learn more on [Licensing for Power Virtual Agents](https://docs.microsoft.com/power-virtual-agents/requirements-licensing-subscriptions) on capabilities that require a standalone Power Virtual Agents subscription.



## Prerequisites

To install and use the Employee FAQ template you will need a Microsoft Teams account. If you do not have this, [sign up here](https://www.microsoft.com/microsoft-teams/group-chat-software) and make an account before proceeding.



## Installation

First, add the required apps to Teams, and create your Power Apps app:

1. Download the Employee FAQ template solution.
2. Add the [Power Virtual Agents app in Microsoft Teams](https://teams.microsoft.com/l/app/1850b8bb-76ac-411c-9637-08f7d1812d35?source=store-copy-link), you can search for it directly in Microsoft Teams app store.
3. Add the [Power Apps app in Microsoft Teams](https://teams.microsoft.com/l/app/a6b63365-31a4-4f43-92ec-710b71557af9?source=store-copy-link), and open it.
4. It will open the app in **Home** tab and select **Start now**.
5. Select the team you want to use, and create an application. When prompted, name the application **Demo** and select **Save**.  *If this is the first time you are creating an app in the team, it will take a few seconds to setup a Dataverse database before you are prompted to name the application*

 

Now, import the template solution:

1. In the Power Apps app, select the **Build** tab to see your list of teams on the side panel. 
   

   ![Build Tab](Images/Build-Tab)
   
2. Select the team you choose in the previous step from the list. The app you just created will appear in the main section of the window, this may take a few minutes to update.

3. Select **See all**.
   

   ![See All](Images/See-All)
   
4. On the top menu bar, select **Import**, then select **Browse** in the pane that appears.


   ![Import](Images/Import)

5. Select the template solution you downloaded, and then **Next**.

6. When you see the items to choose to import, make sure everything is selected and click **Next**.

7. If you have connections, select them, if you do not then add them. You will need to add Microsoft Teams, Office and Dataverse connection.


   ![Connections](Images/Connections)

8. Select **Import**.



You have now imported the solution and your can go to the **Build** tab in Power Apps to see all of your items. To use the bot, you will need to go through some additional set up steps.



## Set up and validate Employee FAQ

We need to update Power Automate Flows, validate the Employee FAQ bot is working and add our Employee FAQ Admin application to a teams channel.  Once this section is completed, the Employee FAQ bot's escalation flow will be up and running and ready to be added with your organization's content.



#### Setting up Power Automate flows

1. In the Power Apps app, select the **Build** tab to see your list of teams on the side panel.
   

    ![Build Tab](Images/Build-Tab)


2. Select the team you choose in the previous step from the list, then select **See all** to view the solution overview.


   ![See All Imported](Images/Imported-See-All)

   

3. Select **Cloud flows** on the side panel.
   

   ![Cloud Flows](Images/Cloud-Flows)
   
4. Select the **FAQ Bot - Request** flow to open it.  This flow takes employee's escalation request and notify human expert in a team channel.
   1. Select **Edit**.
   2. Open the action **Convert time zone - Select Your Timezone** and set the **destination time zone** to your timezone.
   3. Open the action **Post adaptive card in a chat or channel - Select Team and Channel**.
   4. Change the **Team** and **Channel** to your desired team and channel for the feedback information adaptive card to be posted to.
   5. Expand the condition action.
   6. Open the action **Convert time zone - Select Your Timezone - Resolved** and set the **destination time zone** to your timezone.
   7. Select **Save**.
   8. Select the back arrow ←.

5. Select the **FAQ Bot - Feedback** flow to open it.  This flow takes employee's feedback and post into a team channel for human expert to review
   1. Select **Edit**.
   2. Open the action **Convert time zone - Select Your Timezone** and set the **destination time zone** to your timezone.
   3. Open the action **Post adaptive card in a chat or channel - Select Team and Channel**.
   4. Change the **Team** and **Channel** to your desired team and channel for the feedback information adaptive card to be posted to.
   5. Select **Save**.



#### Bot Validation

1. Open the **Power Virtual Agents** Teams application.
2. Select **Chatbots**.
3. Select your team.
4. Select your chat bot.
5. Select **Publish** on the left menu.
6. Select **Open the bot**
7. Select **Add** to add the bot into Microsoft Teams for yourself
8. You will now be taken to a chat window with your bot. Here you can try trigger phrases to ensure that the bot is functioning correctly. We have listed several phases you should consider trying below:
   1. Hello
   2. Talk to agent
   3. What is the status of my request
   4. Leave review
9. For **Talk to agent** and **Leave review**, make sure to check the bot posts request and feedback to the team and channel you configured earlier.  _Note that you won't be able to deep link to yourself from the request adaptive card if you are the same person requesting it._


#### Set up Power App Teams tab
You can review the bot's performance in Power Virtual Agents built-in [Analytics]() dashboard.  In addition to the dashboard, Employee FAQ also comes with a Canvas app to allow experts to review the verbal feedback from employees. 
 
1. Select **Apps**.

2. Select the three dots next to the app name (...).

3. Select **Add to Teams**.
   

   ![Add to Teams](Images/Add-to-Teams)


4. Select **Add to Teams** on the side menu that opens.

5. Select the dropdown arrow and select **Add to a team**.

6. Search for your team.

7. Select **Set Up a Tab**.

8. Select **Save**.

 
## Next step
You have now fully set up the Employee FAQ template.  The next step is to go to **Power Virtual Agents** Teams application to add FAQ content for the bot to answer your organization's questions.   [Extension documentation](https://github.com/Flow-Joe/PowerVirtualAgentsSamples/blob/master/Templates/Employee%20FAQ/EXTEND.md) 
