# Connect to Engagement Hub

This sample shows the minimum code required for a Power Virtual Agent client to intercept a handoff activity and connect to an engagement hub to transfer conversation to a live agent.
## Prerequisites

- [.NET Core SDK](https://dotnet.microsoft.com/download) version 2.1

  ```powershell
  # determine dotnet version
  dotnet --version
  ```

## How to try this sample
- When an end-user interacts with a PVA bot over Directline, messages are sent to client in the form of activities. 
- In a dialog, when a node to transfer a chat to a live agent is detected, the activities payload contains a handoff activity that is a trigger to transfer the chat.
- To detect the handoff activity,
    1. Clone the repository
    ```bash
    git clone https://github.com/microsoft/CopilotStudioSamples.git
    ```
    2. Add the HandoffHelper and dependent models on the client to intercept activities payload sent over Directline.
    
- This helper detects an event activity with name - handoff.initiate.
- HandoffHelper also parses conversation context (refer to [HandoffContext.cs](./Handoff/HandoffContext.cs)) and the transcript of the conversation between end-user and bot from the handoff.initiate activity.
- Conversation context and transcript can then be used to write a custom adapter (based on engagement hub APIs) to transfer the chat to a live agent.

## Further reading
- [Configure hand-off to any generic engagement hub](https://go.microsoft.com/fwlink/?linkid=2104701)
