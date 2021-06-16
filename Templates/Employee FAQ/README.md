# Employee FAQ PVA Template

## Overview

The Employee FAQ [Power Virtual Agents](https://powervirtualagents.microsoft.com/) template is designed to allow organizations or departments easily create a bot to handle their employee’s common questions by adding content that matches the business’s needs. Whether it’s HR, IT or other internal employee functions, the Employee FAQ bot template is a great place to start. 

Bots are great at providing automated responses to save your organization cost and time and help your employees, and when it can’t help, it needs a way to escalate to human agents. The Employee FAQ template is a Power Virtual Agents template that can be easily customized and extended to suite your needs. It comes with a built-in capability to log an employee’s escalation request, notify a human agent, and allow them to quickly respond to the employee - all within [Microsoft Teams](https://www.microsoft.com/microsoft-teams/group-chat-software). 

Finally, the Employee FAQ template obtains feedback from the employee on the bot’s performance so you can continuously improve the bot.



## Features

The template supports the following features:



#### Power Virtual Agents bot

- Lessons Topics
- Escalation requests (allow users to make requests with a **Title** and **Description** then post the request to a team for human support with an adaptive card)
- Instant chat links from the request adaptive card to talk to the user that has made a request
- Resolve requests directly in teams via the adaptive card
- Status (provide the status of requests for both **all** and **active** requests)
- Feedback (receive and display feedback to a teams channel with adaptive cards)



#### Power Automate flows

- Receives and stores information into Microsoft Dataverse
- Posts adaptive cards to teams
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
2. Add the [Power Virtual Agents app in Microsoft Teams](https://docs.microsoft.com/power-virtual-agents/teams/authoring-first-bot-teams#add-the-power-virtual-agents-app-in-microsoft-teams).
3. Add the **Power Apps** app in Microsoft Teams, and open it.
4. Go to the **Build** tab and select **Create+** at the bottom of the list of teams.
5. Select the team you want to use, and create an application. When prompted, name the application **Demo** and select **Save** 

 

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



## Set up your Power Virtual Agents bot

We need to update our Power Automate Flows, validate the bot is working and add our Employee FAQ Admin application to a teams channel.



#### Setting up Power Automate flows

1. In the Power Apps app, select the **Build** tab to see your list of teams on the side panel.
   

    ![Build Tab](Images/Build-Tab)


2. Select the team you choose in the previous step from the list, then select **See all** to view the solution overview.


   ![See All Imported](Images/Imported-See-All)

   

3. Select **Cloud flows** on the side panel.
   

   ![Cloud Flows](Images/Cloud-Flows)
   
4. Select the **FAQ Bot - Request** flow to open it.
   1. Select **Edit**.
   2. Open the action **Convert time zone - Select Your Timezone** and set the **destination time zone** to your timezone.
   3. Open the action **Post adaptive card in a chat or channel - Select Team and Channel**.
   4. Change the **Team** and **Channel** to your desired team and channel for the feedback information adaptive card to be posted to.
   5. Expand the condition action.
   6.  Open the action **Convert time zone - Select Your Timezone - Resolved** and set the **destination time zone** to your timezone.
   7. Select **Save**.
   8. Select the back arrow ←.

5. Select the **FAQ Bot - Feedback** flow to open it.
   1. Select **Edit**.
   2. Open the action **Convert time zone - Select Your Timezone** and set the **destination time zone** to your timezone.
   3. Open the action **Post adaptive card in a chat or channel - Select Team and Channel**.
   4. Change the **Team** and **Channel** to your desired team and channel for the feedback information adaptive card to be posted to.
   5. Select **Save**.



#### Bot Validation

1. Open the *Power Virtual Agents* Teams application.
2. Select *Chatbots*.
3. Select your team.
4. Select your chat bot.
5. Select *Publish* on the left menu.
6. Select *Open the bot*
7. Select *Add*
8. You will now be taken to a chat window with your bot. Here you can try trigger phrases to ensure that the bot is functioning correctly. We have listed several phases you should consider trying below:
   1. Hello
   2. Talk to agent
   3. What is the status of my request
   4. Leave review



#### Set up Power App Teams tab

While we are setting the Canvas application up, it is important to note that you can also use the bot session performance in the PVA analytics.

 

1. Select **Apps**.

2. Select the three dots next to the app name (...).

3. Select **Add to Teams**.
   

   ![Add to Teams](Images/Add-to-Teams)


4. Select **Add to Teams** on the side menu that opens.

5. Select the dropdown arrow and select **Add to a team**.

6. Search for your team.

7. Select **Set Up a Tab**.

8. Select **Save**.

 

You have now fully set up the Employee FAQ template.