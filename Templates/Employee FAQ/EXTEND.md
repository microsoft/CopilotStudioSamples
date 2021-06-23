# Extend the Employee FAQ template

## Overview

Now that you have the Employee FAQ set up, you can easily customize and extend it to fit your business needs without needing to be a developer or data scientist. This file is designed to help you begin that journey


## Adding bot content in Power Virtual Agents

The Employee FAQ template can easily be extended in [Power Virtual Agents](https://teams.microsoft.com/l/app/1850b8bb-76ac-411c-9637-08f7d1812d35?source=store-copy-link) Teams application by adding new [topics](https://docs.microsoft.com/power-virtual-agents/teams/authoring-fundamentals-teams), [messages](https://docs.microsoft.com/power-virtual-agents/teams/authoring-create-edit-topics-teams#create-a-topic), [questions](https://docs.microsoft.com/power-virtual-agents/teams/authoring-create-edit-topics-teams#ask-a-question), [actions](https://docs.microsoft.com/power-virtual-agents/teams/advanced-flow-teams) and more. 

As a starting point, we suggest looking at the greeting system topic, customizing it to provide a personal greeting that represents your company and how you want your users to start using the bot. There are also [four lessons provided](https://docs.microsoft.com/power-virtual-agents/authoring-template-topics) with the template to get you started on familiarizing yourself with Power Virtual Agents. Once you have gone through these lessons, you can freely edit the topics or simply create new topics to handle any additional areas you wish to include. You can also quickly and easily add new topics with the built-in [topic suggestion feature](https://docs.microsoft.com/power-virtual-agents/teams/advanced-create-topics-from-web-teams).  

Reach out to the [PVA Community](https://powerusers.microsoft.com/t5/Power-Virtual-Agents-Community/ct-p/PVACommunity) for help and ideas from our community members. 

## Making the bot available to employees
Once you are satisifed with the bot's content, it's time to make it available to employees.  You can easily make the bot available in Microsoft Teams app store by following the steps to [share the bot with your organization](https://docs.microsoft.com/en-us/power-virtual-agents/teams/publication-add-bot-to-microsoft-teams-teams#share-the-bot-with-your-organization).  We recommend to partner with your IT admin to also pre-pin the bot on the left rail so employees can easily discover the bot in Microsoft Teams without needing to manually install it.  Learn more about best practice guidance to [partner with admin to roll out bot in Microsoft Teams](https://powervirtualagents.microsoft.com/blog/partner-with-admin-to-roll-out-bot-in-microsoft-teams/).

Alternatively, you can also directly [share the bot's installation link](https://docs.microsoft.com/power-virtual-agents/teams/publication-add-bot-to-microsoft-teams-teams#install-a-bot-as-an-app-in-microsoft-teams) with others in the organization without going through the admin approval process.  Make sure you change the bot's [access](https://docs.microsoft.com/power-virtual-agents/teams/configuration-security-teams) to fit your target audience so they have permission to install the bot.


## Extending employee feedback content
The data model structure for logging feedback is structured around basic core principles for gathering feedback. It’s aimed at providing customers with a basic toolset for logging and reporting on that feedback, and giving the capability to extend it. 



#### In-depth review of the feedback data model

 

![Data Model](Images/Data-Model)

The first part of gathering feedback is from a **Survey Response**. A **Survey Response** has core information, including the name of the person who the survey was related to, the channel it was originally obtained on, and when the response was created.



A survey response can have multiple questions associated to it, which is displayed through the **Survey Question** table. The **Survey Question** table has only the question and the link to the originating **Survey Response**. 



The survey response tracks what the **Survey Question** was and has a related table called **Question Response**. The response is linked back to the originating question and is the original response to the question from the respondent on the **Survey Response**.

 

This initial data model allows for basic principles of feedback to be followed, and separating the **Survey Response**, **Survey Question**, and **Question Response** to allow for extension and additional reporting. By default, the Power Virtual Agent bot is setup for customer satisfaction (CSAT) type questions. 



## Extending the Survey Data Model



A canvas application using the Dataverse model allows users to track feedback in a list format, giving visibility of who the respondent is, the feedback, when it was obtained, and the satisfaction score where it is relevant. 

The **Respondent Name** is currently logged as text, as well as ‘CSAT’. This can be sufficient in most cases where simply knowing and tracking the feedback is enough, however, to provide aggregation and metric-based reports, CSAT would need to be extended to be a number-type field to allow for aggregation. 

This can be done in several ways, including in Power Automate, Dataverse or Power BI, based on the administrator's preference and specific needs. In the same way, **Respondent Name** can be extended to be a lookup reference to a **User** table by modifying the Power Automate contained in the solution to search for and get the related user record. 



## Extending the Data Model itself

In addition to using existing information available, administrators can also add lookups and other data points to the Survey Response table. 

Examples include using the ‘User’ table to provide more information such as which team they are in, geography or region information, allowing feedback to be aggregated across additional dimensions and providing insight into the feedback in those areas. 

Another example of extending the data model is to add choices to the choices field for ‘Channels’ to include additional options based on what is being used in the business (it currently defaults to ‘Bot’ in the provided solution)



## Using the data model for user and customer feedback

The current functionality for the Power Virtual Agent Bot has been developed to support logging user or internal requests and feedback. The same data model built for logging feedback from those users can also be used to track the same data model for customer experiences in some cases, depending upon the maturity of your organization. 

An example of using the feedback data model for customers would be to log the survey question and response from a bot deployed on a website.

Extensions can be made to the data model to capture specific dimensional data such as ‘Stores’ and ‘Locations’ in a retail or manufacturing industry to then report on feedback from those dimensions, identifying improvement or issues at a store or location.



## Extending the number and types of questions asked

Administrators can also extend the bot to ask more questions of the user, and modify the related flow using Power Automate to be able to tailor the feedback questions being asked after the request has been made. 

This experience can be adding questions to the experience or tailoring the type of question asked of the user and what type of response is back. Currently supported are single-type text questions.



## Extending with Power BI

Enhanced reporting can be built on the data model using Power BI for a visual experience, adding charts and tables for extended viewing and sharing of the data. Power BI can also be used to provide high level branded reporting such as the overall CSAT based on related data for the year, and more.

You can connect your data stored in Dataverse for Teams to Power BI to visualize that data in numerous ways. The main way to connect to your data is to click on ‘Dataverse’ button in Power BI Desktop in the toolbar and enter in your environment details.  

To learn how to get your environment details and for a step by step guide on authenticating Power BI with Dataverse for Teams, check out the [View Dataverse for Teams table data in Power BI Desktop](https://docs.microsoft.com/powerapps/teams/view-table-data-power-bi) document.

Once connected to Dataverse for Teams, select the Table’s you wish to view in the ‘Navigator’ window and click ‘Load’. Depending on the amount of data being loaded, this can take a few minutes. Once this is completed, you can then access your Tables on the right hand side of the ‘Report’ view. 
