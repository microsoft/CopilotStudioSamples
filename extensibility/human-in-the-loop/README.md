# Human-in-the-Loop Custom Connector

A sample custom connector that implements the **Human-in-the-Loop** pattern for Copilot Studio agents and Power Automate flows. When an agent or flow needs human input, it calls this connector — the execution pauses, a human sees the request in a web console, responds, and the agent/flow resumes.

## How It Works

```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│ Copilot Studio      │     │ HITL Backend         │     │ Human (Browser)     │
│ or Power Automate   │     │ (this service)       │     │                     │
│                     │     │                      │     │                     │
│ 1. Calls connector  │────▶│ 2. Stores request    │     │                     │
│    action           │ 202 │    Returns 202       │     │                     │
│                     │◀────│                      │     │                     │
│ 3. Pauses (waits    │     │                      │────▶│ 4. Shows form in    │
│    for callback)    │     │                      │     │    web console      │
│                     │     │                      │     │                     │
│                     │     │ 6. POSTs response    │◀────│ 5. Human fills in   │
│ 7. Resumes with     │◀────│    to notificationUrl│     │    and submits      │
│    human's response │     │                      │     │                     │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
```

The key mechanism is the **`x-ms-notification-url`** OpenAPI extension. When Power Platform invokes a connector action with this annotation:

1. It auto-generates a callback URL and injects it into the `notificationUrl` field
2. The connector returns **202 Accepted** — the caller pauses
3. When the backend POSTs to `notificationUrl`, the caller resumes with the response

This works identically in both Copilot Studio agents and Power Automate flows.

## Prerequisites

- **Node.js 18+**
- **devtunnel CLI** — `brew install devtunnel` ([docs](https://learn.microsoft.com/azure/developer/dev-tunnels/get-started))
- **paconn** — `pip install paconn` ([docs](https://learn.microsoft.com/connectors/custom-connectors/paconn-cli))

## Quick Start

### Automated Setup

```bash
# One command: installs deps, creates tunnel, deploys connector
./setup.sh

# Or just set up the tunnel (deploy connector manually later)
./setup.sh --tunnel-only
```

### Manual Setup

```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start

# 3. In another terminal, create a dev tunnel
devtunnel create hitl-sample --allow-anonymous
devtunnel port create hitl-sample --port-number 3978 --protocol https
devtunnel host hitl-sample

# 4. Deploy the connector (update host in apiDefinition.swagger.json first)
paconn create \
  --api-def connector/apiDefinition.swagger.json \
  --api-prop connector/apiProperties.json
```

### Local Testing (No MCS/PA Required)

```bash
# Terminal 1: Start the backend
npm start

# Terminal 2: Run the test script (simulates an agent/flow calling the connector)
node test-local.js

# Browser: Open http://localhost:3978 — fill in the form and submit
```

The test script starts a mock callback server, sends a sample HITL request, and prints the human's response when they submit.

## Components

### Backend (`server.js`)

Express server with these endpoints:

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/requests` | Receives request from connector, returns 202 |
| `GET` | `/api/requests?status=pending` | Lists requests for the console UI |
| `GET` | `/api/requests/:id` | Gets a specific request |
| `POST` | `/api/requests/:id/respond` | Human submits response → POSTs to callback URL |
| `GET` | `/api/health` | Health check |

### Web Console (`public/index.html`)

Browser UI where humans see pending requests and respond. Auto-refreshes every 5 seconds. Renders form fields dynamically based on the `inputs` array from the request.

### Custom Connector (`connector/`)

- **`apiDefinition.swagger.json`** — OpenAPI spec for Power Platform. The `x-ms-notification-url` annotation is what makes the async webhook pattern work.
- **`apiProperties.json`** — Connector metadata (display name, icon color).

## Input Field Types

The connector supports these input field types:

| Type | Renders As | Extra Properties |
|------|-----------|-----------------|
| `text` | Multi-line textarea | `placeholder` |
| `number` | Number input | `placeholder` |
| `date` | Date picker | — |
| `time` | Time picker | — |
| `choiceset` | Dropdown or checkboxes | `items[]`, `isMultiSelect` |

All types support `id` (required), `title`, and `isRequired`.

## Using in Copilot Studio

1. Run `./setup.sh` to deploy the connector
2. In Copilot Studio, go to your agent → **Actions** → **Add an action**
3. Search for "Human-in-the-Loop" (your custom connector)
4. Add the "Request Human Input" action to a topic
5. Configure the inputs (title, message, form fields)
6. The agent will pause when it reaches this action and resume when the human responds

## Using in Power Automate

1. Run `./setup.sh` to deploy the connector
2. In Power Automate, create or edit a flow
3. Add a new step → search for "Human-in-the-Loop"
4. Configure the "Request Human Input" action
5. Use the response fields in subsequent steps
6. The flow pauses (shows "Waiting" in run history) until the human responds

## Production Considerations

This is a sample — for production use, you would want:

- **Persistent storage** — replace the in-memory Map with a database
- **Authentication** — add OAuth or API key to the connector and web console
- **Authorization** — validate that the person responding is authorized
- **Notifications** — push alerts (email, Teams, mobile) when requests arrive
- **Expiry** — timeout requests that aren't responded to
- **HTTPS hosting** — deploy to Azure App Service, Container Apps, etc.
- **Retry logic** — handle callback failures with retries and dead-letter queue
