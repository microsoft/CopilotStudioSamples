# Employee FAQ PVA Template

## Overview

Bots are great at helping your employees to self serve HR, IT or any other internal employee functions by providing automated responses and taking meaningful actions.  This increases employee's efficiency and saves your organization cost and time.  

Bots have limitations and when a bot can’t help, it needs a way to connect employee with human subject matter experts. The Employee FAQ bot template is built with [Power Virtual Agents](https://powervirtualagents.microsoft.com/) that comes with a built-in capability to log an employee’s escalation request, notify a human expert, and allow them to quickly respond to the employee - all within [Microsoft Teams](https://www.microsoft.com/microsoft-teams/group-chat-software). It also obtains employee feedback so you can make improvements to the bot over time.  Being built on top of Power Virtual Agents, it can be easily customized and extended to suit your needs with no developer and data science background required. 


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



#### Language Support

Each language has its own solution file in the **Solutions** folder. The supported languages are listed below:


- Chinese Simplified
- Chinese Traditional
- Dutch
- English
- French
- German
- Indonesian
- Japanese
- Portuguese (Brazilian)
- Spanish



## License requirement

Employee FAQ template can be used with Office licenses that include Power Virtual Agents. Learn more about [Licensing for Power Virtual Agents for Teams]( https://docs.microsoft.com/power-virtual-agents/teams/requirements-licensing-teams). Easy way to check is if you can launch [Power Virtual Agents Teams app](https://aka.ms/PVAForTeams) in your Microsoft Teams client.

As you extend the bot beyond what is included in the template, you may be required to upgrade to a premium license. Learn more on [Licensing for Power Virtual Agents](https://docs.microsoft.com/power-virtual-agents/requirements-licensing-subscriptions) on capabilities that require a standalone Power Virtual Agents subscription.



## Prerequisites

To install and use the Employee FAQ template you will need a Microsoft Teams account. If you do not have this, [sign up here](https://www.microsoft.com/microsoft-teams/group-chat-software) and make an account before proceeding.



## Installation

First, add the required apps to Teams, and create your Power Apps app:

1. Download the appropriate [Employee FAQ template solution](https://github.com/microsoft/CopilotStudioSamples/tree/master/Templates/Employee%20FAQ/Solutions).
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
   
      ![image-20210625083852787](Images/Convert-Timezone)
   
   3. Open the action **Post adaptive card in a chat or channel - Select Team and Channel**.
   
   4. Change the **Team** and **Channel** to your desired team and channel for the feedback information adaptive card to be posted to.
   
      ![image-20210625084000793](Images/Post-Adaptive-Cards-To-Channel)
   
   5. Expand the condition action.
   
   6. Open the action **Convert time zone - Select Your Timezone - Resolved** and set the **destination time zone** to your timezone.
   
      ![image-20210625082226694](Images/Convert-Timezone-Resolved)
   
   7. Select **Save**.
   
   8. Select the back arrow ←.
   
5. Select the **FAQ Bot - Feedback** flow to open it.  This flow takes employee's feedback and post into a team channel for human expert to review
   1. Select **Edit**.
   
   2. Open the action **Convert time zone - Select Your Timezone** and set the **destination time zone** to your timezone.
   
      ![image-20210625083852787](Images/Convert-Timezone)
   
   3. Open the action **Post adaptive card in a chat or channel - Select Team and Channel**.
   
   4. Change the **Team** and **Channel** to your desired team and channel for the feedback information adaptive card to be posted to.
   
      ![image-20210625084000793](Images/Post-Adaptive-Cards-To-Channel)
   
   5. Select **Save**.



#### Bot Validation

1. Open the **Power Virtual Agents** Teams application.

2. Select **Chatbots**.

   ![image-20210624085406534](Images/Chatbots-Tab)

3. Select your team.

4. Select your chat bot.

5. Select **Publish** on the left menu.

   ![image-20210624085529455](Images/Publish)

6. Select **Open the bot**

   ![image-20210624091613705](Images/Open-The-Bot)

7. Select **Add** to add the bot into Microsoft Teams for yourself
   
   ![image-20210624091730109](Images/Add-Bot)
   
8. You will now be taken to a chat window with your bot. Here you can try trigger phrases to ensure that the bot is functioning correctly. We have listed several phases you should consider trying below:
   1. Hello
   2. Talk to agent
   3. What is the status of my request
   4. Leave review

9. For **Talk to agent** and **Leave review**, make sure to check the bot posts request and feedback to the team and channel you configured earlier.  _Note that you won't be able to deep link to yourself from the request adaptive card if you are the same person requesting it._


#### Set up Power App Teams tab
You can review the bot's performance in Power Virtual Agents built-in [Analytics]() dashboard.  In addition to the dashboard, Employee FAQ also comes with a Canvas app to allow experts to review the verbal feedback from employees. 

1. Open the **Power Apps** app.

2. Select your team

3. Select **See All**.

   ![See All](Images/See-All)

4. Select the three dots next to the app name (...).

5. Select **Add to Teams**.


   ![Add to Teams](Images/Add-to-Teams)


4. Select **Add to Teams** on the side menu that opens.

5. Select the dropdown arrow and select **Add to a team**.

   ![image-20210624093848351](Images/Admin-App)

6. Search for your team.

   ![image-20210624094149397](Images/Search-For-Your-Team)

7. Select **Set Up a Tab**.

8. Select **Save**.

   ![image-20210624094322060](Images/Save-Button)

9. Open your team

10. Select the Employee FAQ tab

    ![image-20210624085246459](Images/Power-App-Tab)
    
11. Once selected you will see the Employee FAQ Admin Canvas App. You will be able to view requests and feedback.

    ![image-20210627145421913](Images/Employee-App)

    

    


## Next steps
You have now fully set up the Employee FAQ template.  The next step is to go to **Power Virtual Agents** Teams application to add FAQ content for the bot to answer your organization's questions. [Extension documentation](https://github.com/Flow-Joe/PowerVirtualAgentsSamples/blob/master/Templates/Employee%20FAQ/EXTEND.md) 



#### Adding bot content in Power Virtual Agents

The Employee FAQ template can easily be extended in [Power Virtual Agents](https://teams.microsoft.com/l/app/1850b8bb-76ac-411c-9637-08f7d1812d35?source=store-copy-link) Teams application by adding new [topics](https://docs.microsoft.com/power-virtual-agents/teams/authoring-fundamentals-teams), [messages](https://docs.microsoft.com/power-virtual-agents/teams/authoring-create-edit-topics-teams#create-a-topic), [questions](https://docs.microsoft.com/power-virtual-agents/teams/authoring-create-edit-topics-teams#ask-a-question), [actions](https://docs.microsoft.com/power-virtual-agents/teams/advanced-flow-teams) and more. 

As a starting point, we suggest looking at the greeting system topic, customizing it to provide a personal greeting that represents your company and how you want your users to start using the bot. There are also [four lessons provided](https://docs.microsoft.com/power-virtual-agents/authoring-template-topics) with the template to get you started on familiarizing yourself with Power Virtual Agents. Once you have gone through these lessons, you can freely edit the topics or simply create new topics to handle any additional areas you wish to include. You can also quickly and easily add new topics with the built-in [topic suggestion feature](https://docs.microsoft.com/power-virtual-agents/teams/advanced-create-topics-from-web-teams).  

Reach out to the [PVA Community](https://powerusers.microsoft.com/t5/Power-Virtual-Agents-Community/ct-p/PVACommunity) for help and ideas from our community members. 


#### Making the bot available to employees

Once you are satisfied with the bot's content, it's time to make it available to employees.  You can easily make the bot available in Microsoft Teams app store by following the steps to [share the bot with your organization](https://docs.microsoft.com/en-us/power-virtual-agents/teams/publication-add-bot-to-microsoft-teams-teams#share-the-bot-with-your-organization).  We recommend to partner with your IT admin to also pre-pin the bot on the left rail so employees can easily discover the bot in Microsoft Teams without needing to manually install it.  Learn more about best practice guidance to [partner with admin to roll out bot in Microsoft Teams](https://powervirtualagents.microsoft.com/blog/partner-with-admin-to-roll-out-bot-in-microsoft-teams/).

Alternatively, you can also directly [share the bot's installation link](https://docs.microsoft.com/power-virtual-agents/teams/publication-add-bot-to-microsoft-teams-teams#install-a-bot-as-an-app-in-microsoft-teams) with others in the organization without going through the admin approval process.  Make sure you change the bot's [access](https://docs.microsoft.com/power-virtual-agents/teams/configuration-security-teams) to fit your target audience so they have permission to install the bot.



## Errors

Error code: 2012

This is an error for either importing Power Automate Flow problems or that the Flows have been changed/renamed. If you are experiencing this error, ensure that the Power Automate Flows are turned on. If the problem persists either reimport the solution or, if you have made changes, delete and then re-add the Flows to the PVA topics.
