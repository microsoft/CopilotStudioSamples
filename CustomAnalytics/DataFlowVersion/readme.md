# Custom analytics solution for Power Virtual Agents - DataFlows version for higher scale bots

If your Bot has significant numbers of monthly sessions, using this version of the report provides improved scalibility. This version does require additional setup, and a Power BI Premium license <https://powerbi.microsoft.com/en-us/pricing/>. The report uses Power BI DataFlows to connect to DataVerse and pre-process some of the compute-intensive transformations of the data.

## Solution components

- Microsoft Dataverse
- Microsoft Power BI DataFlows
- Microsoft Power BI Desktop
- Chat Transcripts control for Power BI - available at <https://github.com/iMicknl/powerbi-botframework-chat-transcripts>
- (Optional) Azure Data Lake Storage v2

## Solution files

- PVA_Analytics_Export_Transform.json - this is the template for a PowerBI DataFlow
- PVA_Dashboard.pbit - Power BI template file

## Installation

### Installation requirements

- One or more Power Virtual Agents bots
- A Power BI account
- [Power BI Desktop](https://powerbi.microsoft.com/en-us/downloads/)

### Installation steps

1. **Edit the DataFlow template**
   1. [Find your Dataverse environment URL](https://docs.microsoft.com/en-us/powerapps/maker/data-platform/data-platform-powerbi-connector#find-your-dataverse-environment-url), the URL will be in the format: https://yourenvironmentid.crm.dynamics.com/. You will just need the 'yourenvironmentid' part of the URL
   2. Download the file [PVA Analytics_Export_Transform.json](PVA_Analytics_Export_Transform.json?plain=1) and open it in a text editor, e.g. Visual Studio Code.
   3. Perform a find and replace on the file - swapping the placeholder `yourdataverse` with your Dataverse environment URL.

2. **Create the DataFlow from the template**
   1. Log in to Power BI at <http://powerbi.com>
   2. Select the Workspace you wish to deploy the DataFlow to or create a new workspace. Please note that you cannot use 'My Workspace' for this purpose. 
   3. Select New > DataFlow
   4. Select Import Model
   5. Select the edited file 'PVA Analytics_Export_Transform.json'. Your DataFlow job should now be ready - test refreshing the data.
   6. You should be prompted for credentials, if not go to Settings -> Data source credentials and select organizational account. You can now login with an Azure Active Directory account that has access to the Dataverse environment.
   7. Whilst in Settings for your DataFlow, be sure to select 'Enhanced compute engine settings' and select 'On'.
   8. If you want to refresh the content periodically, go to Settings -> Scheduled refresh and select the preferred period.

3. **Create your Power BI report**
   1. Download the file [PVA_Dashboard_DataFlow.pbit](PVA_Dashboard_DataFlow.pbit?plain=1)
   2. Enter the parameters you are prompted for. These are:
      1. The name of the Power BI workspace
      2. The name of the DataFlow you created
   3. The report should pull in the data and render it
   4. You can now [publish the report from Power BI Desktop](https://docs.microsoft.com/en-us/power-bi/create-reports/desktop-upload-desktop-files) so that other users can access it.

## Connecting Azure Data Lake Storage for data archival

Please follow the instructions in the main [readme](../readme.md) for details of setting this up. Instead of consuming the DataFlow containing the ConversationTranscript records (stored in Azure Data Lake) in the Power BI report, it should be consumed in the PVA Analytics_Export_Transform DataFlow (change the source of ConversationTranscript from Dataverse to point the Azure Data Lake DataFlow).

## Troubleshooting

There are a few places where the pipeline may break - troublshooting can normally isolate the problem using these steps:

1. Ensure that data is being pulled in to your DataFlow correctly. Open the DataFlow for editing (select 'edit entities'), and on each of the tables, select refresh to ensure that data is being populated.
2. Ensure that your Power BI report is connecting to DataFlows. If an error happens when you first pull in data, select 'Transform data' in the navigation menu to open Power Query
   1. Refresh each table in the 'Raw Data' folder - these correspond to the data in the DataFlow.
   2. If this fails also, test you have permissions to the DataFlow. An easy way to do this is to open the 'bot' query at the top of the query list, and select 'Source' at the top of the 'Applied steps' control. This lists all the DataFlows you have access to.
3. If both of the steps above succeed, but you still have errors, please raise an issue in this repo.
