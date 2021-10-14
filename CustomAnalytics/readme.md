# Custom analytics solution for Power Virtual Agents

This solution allows customers to create a Power BI dashboard for their Power Virtual Agents chatbots, and includes pre-created screens to show all-up performance, customer satisfaction, topics and transcripts. There are two versions of the solution, the base report found here (most users should start with this), and a [high scale version](DataFlowVersion/readme.md), using Power BI Dataflows, for large bots.

<img src="img/PVA_Analytics.png" width="797" alt="Custom Analytics example screenshot">

## Solution components

- Microsoft Dataverse
- Microsoft Power BI Desktop
- Chat Transcripts control for Power BI - available at <https://github.com/iMicknl/powerbi-botframework-chat-transcripts> - many thanks to Mick Vleeshouwer

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
      1. The URI of you Dataverse instance (e.g. mydataverse.crm.dynamics.com - note the removal of 'https://' and the trailing slash)
   3. The report should pull through the data and render it
   4. You can now save the report to share through the Power BI portal.

## Using the report

The report is based on what is shared through the Power Virtual Agents portal, but with some important differences:

- The report includes all bots in your environment
- The report includes a date filter - and can support a range of dates greater than the 30 days supported natively in Dataverse
- The report includes all trace data emitted with the bot, allowing users to build reports on data import to them
- The report can be shared with users and business decision makers without access to Power Virtual Agents

## Troubleshooting

1. Ensure you have permission to access the TDS endpoint in Dataverse. Empty data tables may indicate a permissions problem.
2. Please raise issues in this repo for other problems.
