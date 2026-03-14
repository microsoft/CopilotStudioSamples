# Typeahead suggestions for Copilot Studio 
This code sample allows you to create a typeahead suggestion functionality for your custom copilot. This assists users finding things like frequently asked questions, auto correcting typos and showing a list of menu items. The v1 uses an API that returns topic names for given Agent but the sample can be used with any REST endpoint to show suggestions.

Please note that v1 calls the API once and loads the suggestions for your bot when the chat is initiated. It then filters through these suggestions based on user's questions.
Please note that v2 which is built using REACT component, calls the API every time users asks a question and shows the relevant suggestion based on each question when user type '/'

## Getting Started

1. Create your custom copilot using copilot studio with required topics and actions.
2. Once you have published your copilot go to mobile channel and copy the DirectLine endpoint URL.
3. Download the TypeAheadSuggestion.HTML canvas to your local machine and open in any code editor.
4. On line 158 replace the direct endpoint you copied for your copilot. Please note that for best practices you can use the DirectLine token instead of using secret in the canvas.
<img width="853" alt="image" src="https://github.com/user-attachments/assets/fd8a9800-2e95-40e1-b10f-a8b060fa61bb">
5. Next you will need to add a REST API that returns an array of suggestions for your Agent. For testing, use the TypeAheadSolutionAPI Zip file that has a Power Automate flow that returns topic names for a given Agent. On the Power Automate flow edit the list row action and replace the existing botid with your botid.

<img width="731" alt="image" src="https://github.com/user-attachments/assets/628fa504-e534-4e5c-bd03-29fa351d96bf">

7. On line 222 Add your REST API endpoint that returns an array of suggested topics.
   <img width="830" alt="image" src="https://github.com/user-attachments/assets/58f1608e-c87f-42e9-b8de-547142edefe6">
   
8. Optional: If you would like to exclude suggestions based on your business logic you can create a exclusion list as shown below on line 173.
   <img width="306" alt="image" src="https://github.com/user-attachments/assets/c7abb501-e3f4-4e67-a6d4-c7852fadca4a">
   
9. Click Save and open the file in the browser to test. You can launch the Agent by clicking on the chat bubble and initiating the chat.

10. To see list of suggestions before typying click the space bar which opens a dropdow list of suggested topics
    
11. For getting type-ahead suggestions continue to type in the Agent canvas and suggestions will be shown below the chat area. Clicking on any suggestion submits the utterance to the Agent.

# Watch below demo to get started with V1

[![Watch the video](https://th.bing.com/th/id/OIP.9k6Gz3sbmi5b8r6YxTSG-QHaEK?w=289&h=180&c=7&r=0&o=5&dpr=1.5&pid=1.7
)](https://www.youtube.com/watch?v=7xbSpzmQcIg)

# Watch below demo to get started with V2
[![Watch the video](https://th.bing.com/th/id/OIP.9k6Gz3sbmi5b8r6YxTSG-QHaEK?w=289&h=180&c=7&r=0&o=5&dpr=1.5&pid=1.7
)](https://youtu.be/H9_r7R4iNOU)
