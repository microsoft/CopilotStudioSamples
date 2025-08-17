# Auto Detect Language for Generative Responses

Sample solution showing how to provide a way to allow Copilot Studio agents to autodetect the spoken language and use one of the maker approved languages for their agent. 

## Benefits for this approach:
1.	Ability to allow agent to auto respond to the user in the language that the user speaks to the agent in no matter when in the conversation it is done.
1.  Allows the maker to approve what languages will be spoken without allowing all languages to be leveraged to ensure alignment to other parts of the solution.
1.  Works in conjunction with other samples such as the Generative Chit Chat sample 

## Downsides:
1.	Maker must approve the use of a language in order to allow it to be autodetected.
1.	Maker must add logic to topic to support additional languages.
1.  Maker must modify the sample before using to ensure that languages in sample align to available languages approved by the maker or errors can happen if a user trys a language that is not approved by the maker but is in the topic.

## Instructions:
1.	Install the solution in this GitHub Repo to get the Auto Detect Language component collection installed into your environment.
1.  In the agent that you want to add Auto Detect Language to, go to Settings and then select the Component Collections tab in navigation. Then click on Available in the section for Manage component collections.  Hover over the Auto Detect Language component collection and click the "..." and then click "Add to agent".
1.  Go to Topics in your agent and confirm that you see the Detect Language topic.
1.  Go into the Topic and click "View model details" in the Prompt and modify the prompt as you see fit for your organizational needs or select model you want to use for language detection. (Optional)
1.  In your agent you need to add the languages that you want to support by going to Settings, Languages on the left navigation, Click Add language and select the language you want to add. (You will need to upload a localization file for any topics that are not generatively created)
1.  Edit the Detect Language topic to include a condition that maps the detected language value to the one you want set in User.Language (Example Spanish to Spanish_US or Spanish)
1.  Open Test chat and provide a query that you want to test translation on as "¿Qué altura tiene el Empire State Building?" (Assuming you have Spanish Enabled)

## Limitations:
 - Only generated responses will be effected that are created via the Copilot Studio generative orchestrator
 - Prompts can be modified to use the user.language value see the Generative Chit Chat sample prompt to see how
 - Only languages approved by the maker and then added to the topic will be correctly translated.
 - Languages like Spanish that have different dilects in Spain vs Latin America will need to be mapped to the correct ones.  You may need to modify the Prompt if you want more details for dilect specifics to be pulled up.
 - This will override the default behavior of Copilot Studio for only the agent deployed to.j
 - Makers looking to leverage different language configs will need to pull the solution out of the component collection as this will allow for different configs in different agents.
 
