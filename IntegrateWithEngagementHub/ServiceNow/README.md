# Copilot Studio - ServiceNow Integration Samples

This repository contains sample code for integrating Microsoft Copilot Studio with ServiceNow Virtual Agent, enabling seamless handoff from AI agent to live agent.

## Assets Included

- **Azure Function** (`relayToDirectLine.js`) - Relay service that bridges ServiceNow with the Direct Line API
- **ServiceNow Script Include** (`CustomDirectLineInboundTransformer.js`) - Custom transformer that detects handoff events and triggers agent escalation

These samples are companion code for the official documentation at: https://learn.microsoft.com/en-us/microsoft-copilot-studio/customer-copilot-servicenow

> **Note**: Detailed setup instructions and deployment guidance coming soon.