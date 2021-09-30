# Custom analytics solution for Power Virtual Agents

This solution allows customers to create a Power BI dashboard for their Power Virtual Agents chatbots, and includes pre-created screens to show all-up performance, customer satisfaction, topics and transcripts. There are two versions of the solution, the base report found here (most users should start with this), and a version using [Power BI DataFlows](DataFlowVersion/readme.md) for additional scalability with large datasets.

<img src="img/PVA_Analytics.png" width="797" alt="Custom Analytics example screenshot">

## Solution components

- Microsoft Dataverse
- Microsoft Power BI Desktop
- Chat Transcripts control for Power BI - available at <https://github.com/iMicknl/powerbi-botframework-chat-transcripts> - many thanks to Mick Vleeshouwer
- (Optional) Azure Data Lake Storage v2

## Solution files

- PVA_Dashboard.pbit - Power BI template file

## Installation

### Installation requirements

- One or more Power Virtual Agents bots
- A Power BI account
- [Power BI Desktop](https://powerbi.microsoft.com/en-us/downloads/)

### Installation steps

1. Create your PowerBI report
   1. Open the file PVA_Dashboard.pbit
   2. Enter the parameter you are prompted for. This is:
      1. [The URI of you Dataverse instance](https://docs.microsoft.com/en-us/powerapps/maker/data-platform/data-platform-powerbi-connector#find-your-dataverse-environment-url) (e.g. mydataverse.crm.dynamics.com - note the removal of 'https://' and the trailing slash)
   3. The report should pull through the data and render it
   4. You can now save the report to share through the Power BI portal.

## Connecting Azure Data Lake Storage for data archival

Optional - if you wish to store and use telemetry longer than it is stored in your Dataverse instance (default 30 days), you can configure export to Azure Data Lake using Azure Synapse Link. Steps for configuring this are as follows:

!Important - always test this process on a development environment before applying to your production system.

1. Set up an Azure Data Lake, and connect to it using Azure Synapse Link. See the steps documented here for details: <https://docs.microsoft.com/en-us/powerapps/maker/data-platform/azure-synapse-link-data-lake>.
2. Configure the conversationtranscript table for export using Azure Synapse Link
   1. In the Power Apps portal, select Azure Synapse Link - select the link you created in step 1 - Manage tables
   2. Search for 'conversationtranscript' - Save.
   3. Transcipts will now be exported to your Azure Data Lake

3. Create a new Power BI DataFlow exposing the data stored in Data Lake
   1. Open your Power BI Workspace - New - DataFlow
   2. Select 'Attach a Common Data Model' folder
   3. Browse you Azure Data Lake container, and paste the URL of your 'model.json' file that describes your data.

4. Add the DataFlow version of conversationtranscipt to your Power BI report
   1. In the Power BI report, select 'Transform Data' to open Power Query
   2. Select Get Data - Power BI DataFlows. Select your new DataFlow
   3. A copy of the conversationtranscript will now be added.
   4. Select the original conversation transcript table in Power Query. In 'Applied Steps' select the top option 'Source'
   5. In the command window, type '= conversationtranscript2' (or the name you have given the new table).
   6. The orignal table will now point to the table coming from the DataFlow.

5. Refresh the report.
6. Note that managing the data in your DataLake will require additional attention, outside the scope of these steps.

## Using the report

The report is based on what is shared through the Power Virtual Agents portal, but with some important differences:

- The report includes all bots in your environment
- The report includes a date filter - and can support a range of dates greater than the 30 days supported natively in Dataverse
- The report includes all trace data emitted with the bot, allowing users to build reports on data import to them
- The report can be shared with users and business decision makers without access to Power Virtual Agents

## Troubleshooting

1. Ensure you have permission to access the TDS endpoint in Dataverse. Empty data tables may indicate a permissions problem.
2. Please raise issues in the repo for other
