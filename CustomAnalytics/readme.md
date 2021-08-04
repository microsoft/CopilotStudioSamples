# Custom analytics solution for Power Virtual Agents

This solution allows customers to create a Power BI dashboard for their Power Virtual Agents chatbots, and includes pre-created screens to show all-up performance, customer satisfaction, topics and transcripts.

<img src="img/PVA_Analytics.png" width="797" alt="Custom Analytics example screenshot">

## Solution components

- Microsoft Dataverse
- Microsoft Power BI DataFlows
- Microsoft Power BI Desktop
- Chat Transcripts control for Power BI - available at <https://github.com/iMicknl/powerbi-botframework-chat-transcripts>
- (Optional) Azure Data Lake Storage v2

## Solution files

- PVA_Analytics_Export.json - this is the template for a PowerBI DataFlow
- PVA_Dashboard.pbit - Power BI template file

## Installation

### Installation requirements

- One or more Power Virtual Agents bots
- A Power BI account

### Installation steps

1. Edit the DataFlow template
   1. FInd the server url associated with your Dataverse environment (it will look like <https://yourservice.crm.dynamics.com>)
   2. Open the file 'PVA Analytics_Export.json' in a text editor
   3. Perform a find and replace on the file - swapping the placeholder "\*\*Your server url here\*\*" with your Datverse URL
2. Create the DataFlow from the template
   1. Log in to Power BI at <http://powerbi.com>
   2. Select the Workspace you wish to deploy the DataFlow to  - or create a new one if you wish (the template defaults to 'PVA_Analytics')
   3. Select New - DataFlow
   4. Select Import Model
   5. Select the edited file 'PVA Analytics_Export.json'. Your DataFlow job should now be ready - test refreshing the data.
3. Create your PowerBI report
   1. Open the file PVA_Dashboard.pbit
   2. Enter the parameters you are prompted for. These are:
      1. The name of the PowerBI workspace
      2. The name of the DataFlow you created
   3. The report should pull through the data and render it
   4. You can now save the report to share through the Power BI portal

## TBD Connecting Azure Data Lake Storage for data archival

Using Azure Data Lake Storage v2, DataVerse can archive the data used in this report, to support datasets greater than 30 days. This pattern is in developement.

## Using the report

The report is based on what is shared through the Power Virtual Agents portal, but with some important differences:

- The report includes all bots in your environment
- The report includes a date filter - and can support a range of dates greater than the 30 days supported natively in Dataverse
- The report includes all trace data emitted with the bot, allowing users to build reports on data import to them
- The report can be shared with users and business decision makers without access to Power Virtual Agents

## Troubleshooting

There are a few places where the pipeline may break - troublshooting can normally isolate the problem using these steps:

1. Ensure that data is being pulled in to your DataFlow correctly. Open the DataFlow for editing (select 'edit entities'), and on each of the tables, select refresh to ensure that data is being populated.
2. Ensure that your Power BI report is connecting to DataFlows. If an error happens when you first pull in data, select 'Transform data' in the navigation menu to open Power Query
   1. Refresh each table in the 'Raw Data' folder - these correspond to the data in the DataFlow.
   2. If this fails also, test you have permissions to the DataFlow. An easy way to do this is to open the 'bot' query at the top of the query list, and select 'Source' at the top of the 'Applied steps' control. This lists all the DataFlows you have access to.
3. If both of the steps above succeed, but you still have errors, please raise an issue in this repo.
