---
title: Account Contact Lookup
parent: Solutions
grand_parent: Authoring
nav_order: 1
---
# Account & Contact Lookup Agent

A Copilot Studio agent that looks up account and contact information from Dataverse using generative AI orchestration.

## Overview

This solution demonstrates a **multi-agent architecture** with a primary orchestrator and two specialized sub-agents:

| Agent | Description |
|-------|-------------|
| **Account Data Lookup Agent** | Orchestrates between account and contact lookups |
| **Account Agent** | Finds accounts and retrieves account details from Dataverse |
| **Contact Agent** | Finds contacts and retrieves contact details from Dataverse |

The agents use the Dataverse `searchquery` unbound action to perform natural-language searches against Account and Contact tables, returning structured results.

## Actions

| Action | Purpose | Searched Columns |
|--------|---------|-----------------|
| Find Account | Search accounts by name, city, state, zip | `name`, `accountid`, `address1_city`, `address1_stateorprovince`, `address1_postalcode` |
| Get Account Details | Get full details for a specific account | `name` |
| Find Contact | Search contacts by name or parent account | `fullname`, `parentcustomerid` |
| Get Contact Details | Get full details for a specific contact | `fullname`, `parentcustomerid` |

## Configuration

- **Model**: GPT-4.1
- **Recognizer**: Generative AI
- **Features enabled**: Generative actions, model knowledge, file analysis, semantic search

## Prerequisites

- Power Platform environment with Dataverse
- Account and Contact tables with data (sample data works)
- Dataverse search enabled on the environment

## Setup

1. Import `solution/AccountLookupAgent_1_0_0_4.zip` into your Power Platform environment
2. Publish the agent in Copilot Studio
3. Test by asking questions like:
   - "Find accounts in New York"
   - "What are the details for Contoso?"
   - "Look up contact John Smith"

## Project Structure

```
account-contact-lookup/
├── README.md
├── solution/                    # Importable solution zip
│   └── AccountLookupAgent_1_0_0_4.zip
└── sourcecode/                  # Exploded solution source
    ├── solution.xml
    ├── customizations.xml
    ├── bots/                    # Bot configuration
    └── botcomponents/           # Topics, actions, and agent definitions
```

## Publisher

Microsoft CAT (Customer Advisory Team)
