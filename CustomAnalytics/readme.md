# Custom analytics solution for Power Virtual Agents
This solution allows customers to create a Power BI dashboard for their Power Virtual Agents chatbots

## Solution components
- Microsoft Dataverse
- Microsoft Power BI DataFlows
- Microsoft Power BI Desktop
- (Optional) Azure Data Lake Storage v2

## Solution files
- PVA_Analytics_Export.json - this is the template for a PowerBI DataFlow
- PVA_Dashboard.pbit - Power BI template file

## Installation

# Installation requirements
- One or more Power Virtual Agents bots
- A Power BI account

# Installation steps
1. Edit the DataFlow template
   1. FInd the server url associated with your Dataverse environment (it will look like https://yourservice.crm.dynamics.com)
   2. Open the file 'PVA Analytics_Export.json' in a text editor
   3. Perform a find and replace on the file - swapping the placeholder "**Your server url here**" with your Datverse URL
2. Create the DataFlow from the template
   1. Log in to Power BI at http://powerbi.com
   2. Select the Workspace you wish to deploy the DataFlow to  - or create a new one if you wish (the template defaults to 'PVA_Analytics')
   3. Select New - DataFlow
   4. Select Import Model
   5. Select the edited file 'PVA Analytics_Export.json'. Your DataFlow job should now be ready - test refreshing the data.
3. Create your PowerBI report
   1. Open the file PVA_Dashboard.pbit
   2. Enter the parameters you are prompted for. These are:
      1. The name of the Powe rBI workspace
      2. The name of the DataFlow you created
   3. The report should pull through the data and render it
   4. You can now save the report to share through the Power BI portal

# TBD Connecting Azure Data Lake Storage for data archival
TBD

## Using the report
The report is based on what is shared through the Power Virtual Agents portal, but with some important differences:

- The report includes all bots in your environment
- The report includes a date filter - and can support a range of dates greater than the 30 days supported natively in Dataverse
- The report includes all trace data emitted with the bot, allowing users to build reports on data import to them
- The report can be shared with users and business decision makers without access to Power Virtual Agents
