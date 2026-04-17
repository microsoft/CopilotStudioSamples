# WorkdayGetInboxTasks

Shows an employee their open inbox tasks from Workday, including task title, process, who submitted it, step type, assigned date, and due date.

## What this scenario does

When an employee asks "What tasks do I have in Workday?" or "Show my open tasks":

1. The agent calls the Workday connector's **GetWorkerInboxTasks** action using the signed-in employee's worker ID.
2. It displays an adaptive card listing all open tasks with title, process name, who submitted it, step type, assigned date, and due date.
3. If the inbox is empty, the agent says so and offers further help.

## Prerequisites

The following are included in the **EssWorkdayHCM base solution** and do not require separate setup:

- **WorkdayRESTExecution** Power Automate flow — active and connected to the WorkdaySOAP connector
- **WorkdaySystemGetRESTExecution** system topic — active in your ESS agent
- `Global.ESS_UserContext_Employee_Id` — populated by the ESS agent at sign-in

## Setup

### 1. Add the topic to your ESS agent

There is no file upload option in Copilot Studio. Add the topic manually using the code editor:

1. Open your ESS agent in Copilot Studio.
2. Go to **Topics** and click **Add a topic** → **From blank**.
3. Give the topic a name, for example **Get Employee Inbox Tasks**.
4. Click the **...** menu on the topic and select **Open code editor**.
5. Select all existing content and replace it with the contents of `topic.yaml`.
6. Save the topic.

### 2. Customize (optional)

Open the code editor and adjust these variables at the top of the topic:

| Variable         | Default | Description                                            |
|------------------|---------|--------------------------------------------------------|
| `Topic.MaxTasks` | `20`    | Number of tasks to fetch per request. Maximum is 100.  |

For example, to show up to 50 tasks:

```yaml
- kind: SetVariable
  id: set_max_tasks
  variable: Topic.MaxTasks
  value: =50
```

### 3. Publish

Publish your ESS agent to make the topic available to users.

## How it works

```text
Employee asks: "What tasks do I have in Workday?"
  |
  Topic calls WorkdaySystemGetRESTExecution
    operationName: GetWorkerInboxTasks
    parameters: workerID, limit, offset
    |
    WorkdayRESTExecution flow
      calls WorkdaySOAP connector (GetWorkerInboxTasks)
        Workday REST API returns task list
  |
  Topic parses response and renders adaptive card
```

## Trigger phrases

- What tasks do I have in Workday?
- Show my open tasks
- What's in my Workday inbox?
- Do I have any pending tasks?
- What actions are waiting for me in Workday?
- My Workday tasks
- Any tasks I need to complete?
