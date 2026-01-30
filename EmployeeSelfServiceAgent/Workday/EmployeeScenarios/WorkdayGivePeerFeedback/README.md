# Workday Give Peer Feedback

## Overview
This scenario enables employees to send feedback to their colleagues through Workday's Talent module. It provides a simple conversational interface to collect the recipient's employee ID and feedback text, then submits it to Workday.

## Features

- **Peer-to-Peer Feedback**: Send feedback to any colleague by their Employee ID
- **Simple Conversation Flow**: Collects recipient ID and feedback text via prompts
- **Immediate Submission**: Feedback is auto-completed and sent immediately
- **Non-Anonymous by Default**: Sender's name is shown to the recipient

## Files

| File | Description |
|------|-------------|
| `topic.yaml` | Copilot Studio topic definition with conversational prompts |
| `msdyn_HRWorkdayHCMEmployeeGiveFeedback.xml` | XML template for Workday Give_Feedback API call |

## Prerequisites

### Global Variables Required
- `Global.ESS_UserContext_Employee_Id` - The sender's Workday Employee ID

### Workday API
- **Service**: Talent
- **Operation**: Give_Feedback
- **Version**: v42.0

## Workflow

```
┌─────────────────────────────────────┐
│   User triggers topic               │
│   (e.g., "Give feedback")           │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Ask for recipient's Employee ID   │
└──────────────┬──────────────────────┘
               │
               ▼
        ┌──────┴──────┐
        │ Employee ID │
        │ provided?   │
        └──────┬──────┘
               │
       ┌───────┴───────┐
       │               │
       ▼               ▼
┌──────────────┐ ┌──────────────┐
│ "Cannot send │ │ Ask for      │
│ to yourself" │ │ feedback text│
└──────────────┘ └──────┬───────┘
                        │
                        ▼
               ┌─────────────────────────────────────┐
               │   Submit to Workday                 │
               │   (Give_Feedback API)               │
               └──────────────┬──────────────────────┘
                              │
                              ▼
                       ┌──────┴──────┐
                       │  Success?   │
                       └──────┬──────┘
                              │
                      ┌───────┴───────┐
                      │               │
                      ▼               ▼
               ┌──────────────┐ ┌──────────────┐
               │ "Feedback    │ │ Show error   │
               │ sent         │ │ message      │
               │ successfully"│ │              │
               └──────────────┘ └──────────────┘
```

## Trigger Phrases

- "Send feedback about Workday"
- "Give feedback on Workday"
- "Workday feedback"
- "Share thoughts on Workday"
- "Submit comments for Workday"
- "Provide input on Workday experience"
- "I want to appreciate my teammate"
- "Give feedback"
- "Share feedback for a colleague"

## Conversation Flow

### Step 1: Collect Recipient
**Agent**: "What is the _Employee ID_ of the colleague you want to give feedback for?"

**User**: "12345"

### Step 2: Collect Feedback
**Agent**: "Please enter your feedback for your coworker."

**User**: "Great job on the project delivery! Your attention to detail really made a difference."

### Step 3: Confirmation
**Agent**: "Feedback is sent successfully"

## XML Template Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `{Employee_ID}` | Sender's Workday Employee ID | `21514` |
| `{Employee_ID_Of_Receiver}` | Recipient's Workday Employee ID | `12345` |
| `{Comment}` | Feedback text | `Great teamwork!` |

## Business Process Configuration

The XML template configures the feedback submission:

| Setting | Value | Description |
|---------|-------|-------------|
| `Run_Now` | true | Submit immediately |
| `Auto_Complete` | true | Complete without approval workflow |
| `Show_Name` | true | Sender's name visible to recipient |
| `Confidential` | false | Not marked as confidential |
| `Private` | false | Not marked as private |

## Response Data

| Field | Description | XPath |
|-------|-------------|-------|
| WID | Workday Internal ID of the feedback event | `//*[local-name()='Give_Feedback_Event_Reference']/*[local-name()='ID'][@type='WID']/text()` |

## Example Interactions

### Example 1: Successful Feedback
**User**: "I want to give feedback to a colleague"

**Agent**: "What is the _Employee ID_ of the colleague you want to give feedback for?"

**User**: "54321"

**Agent**: "Please enter your feedback for your coworker."

**User**: "Thank you for your help with the quarterly report. Your data analysis was excellent!"

**Agent**: "Feedback is sent successfully"

---

### Example 2: Error Scenario
**User**: "Give feedback"

**Agent**: "What is the _Employee ID_ of the colleague you want to give feedback for?"

**User**: "99999"

**Agent**: "Please enter your feedback for your coworker."

**User**: "Great work!"

**Agent**: "There is a failure in sending the feedback: Invalid Employee ID"

## Setup Instructions

1. **Import the Topic**: Import `topic.yaml` into your Copilot Studio agent
2. **Add XML Template**: Upload `msdyn_HRWorkdayHCMEmployeeGiveFeedback.xml` to your Workday connector configuration
3. **Configure Connection**: Ensure your Workday connector connection reference is properly set in the topic
4. **Set Global Variable**: Make sure `Global.ESS_UserContext_Employee_Id` is populated from user authentication

## Dependencies

- `msdyn_copilotforemployeeselfservicehr.topic.WorkdaySystemGetCommonExecution` - Common API execution topic
- `Global.ESS_UserContext_Employee_Id` - Current user's employee ID

## Customization Guide

### Making Feedback Anonymous
To allow anonymous feedback, modify the XML template:

```xml
<bsvc:Show_Name>false</bsvc:Show_Name>
```

### Making Feedback Confidential
To mark feedback as confidential (only visible to recipient and HR):

```xml
<bsvc:Confidential>true</bsvc:Confidential>
```

### Making Feedback Private
To mark feedback as private (only visible to recipient):

```xml
<bsvc:Private>true</bsvc:Private>
```

### Adding Employee Lookup
To enhance the experience, you could add an employee search step before asking for the Employee ID, allowing users to search by name instead of ID.

## Output Type

This topic does not have a structured output type. Success/failure is communicated via messages.
