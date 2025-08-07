# AI Response Generated Chit Chat

Sample solution showing how to provide simple chit chat capabilities to Copilot Studio without the need to enable General Knowledge.  Many makers will not want all of the general knowledge capabilities but would like to have general chit chat work within their agent.  This sample allows for you to do this without the need for General Knowledge.  It is not necessary to do this if general knowledge is on with your agent unless you want to control chit chat differently than knowledge. 

## Benefits for this approach:
1.	Ability to enable chit chat scenarios that are context aware and rich.
1.	Maker can choose the model they want to be used for chit chat separatly from the rest of the agent.
1.	Chit chat personality can be tuned differently than the rest of the agent allowing finer grain of control of the chit chat experience.
1.	Chit chat will support multi-lingual scenarios natively.
1.  Chit chat contained in a central component collection allowing for distribution centraly

## Downsides:
1.	Topic must be used for Chit Chat capability.
1.	Prompt and Topic costs for Chit Chat experience.
1.  Chit Chat configuration needs to be in sync with personality of agent to ensure that agent maintains tone if desired.

## Instructions:
1.	In an agent with Generative Orchestration, in Settings on the Generative AI Tab navigate to the Knowledge section and turn off "Use general knowledge". (Optional if you only want to turn off General Knowledge but enable Chit Chat)
1.  In Topics turn off the default topics called "Greeting" and "Thank you".
1.	Install the solution in this GitHub Repo to get the Chit Chat component collection installed into your environment.
1.  In the agent that you want to add chit chat to, go to Settings and then select the Component Collections tab in navigation. Then click on Available in the section for Manage component collections.  Hover over the Chit Chat component collection and click the "..." and then click "Add to agent".
1.  Go to Topics in your agent and confirm that you see the Chit Chat topic.
1.  Go into the Topic and click "View model details" in the Prompt and modify the prompt as you see fit for your organizational needs or select model you want to use for chit chat. (Optional)
1.  Open Test chat and provide a chit chat that you want to talk to the agent such as "Hey, how are you today?"

## Limitations:
 - Goodbye type chat needs to trigger goodbye topic to properly end the conversation
 
