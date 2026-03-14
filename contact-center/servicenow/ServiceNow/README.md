# Copilot Studio - ServiceNow Integration Samples

This folder contains sample code for integrating Microsoft Copilot Studio with ServiceNow Virtual Agent, enabling seamless handoff from virtual agent to live agent.

## Assets Included

| Asset | Description | File |
|-------|-------------|------|
| **Azure Function** | Relay service that bridges ServiceNow with the Direct Line API | [`DirectLineAzureFunction/relayToDirectLine`](./DirectLineAzureFunction/) |
| **ServiceNow Script Include** | Custom transformer that detects `handoff.initiate` events and triggers agent escalation | [`ScriptIncludes/CustomDirectLineInboundTransformer.js`](./ScriptIncludes/CustomDirectLineInboundTransformer.js) |

These samples are companion code for the official documentation at: [Microsoft Learn - Copilot Studio with ServiceNow](https://learn.microsoft.com/en-us/microsoft-copilot-studio/customer-copilot-servicenow)
