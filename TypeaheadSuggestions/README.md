# Typeahed Suggestions for Copilot Studio 
This code sample allows you to create a typeahead suggestion functionality for your custome copilot that can assist users finding things like frequently asked questions, auto correcting typos and showing a list of menu items like product names or topic names before sending a message to the copilot. The version one uses an API that returns topic names for given bot but the sample can be used with any RestFul endpoint to show relevant suggestions based on your usecase.

### Please note that version 1 calls the API once and loads the suggestions for your bot when the chat is initiated. It then filters through these suggestions based on users questions.
### Please note that version 2 which is built using REACT component calls the API every time users asks a questions and shows the relevant suggestion based on each question when user type '/'



## Getting Started

1. Create your custom copilot using copilot studio with required topics and actions.
2. Once you have published your copilot go to mobile channel and copy the directline endpoint url.
3. Download the TypeAheadSuggestion.HTML canvas to your local machine and open in any code editor.
4. On line 158 replace the direct enpoint you copied for your copilot. Please note that for best practices you can use directline token instead of using secret in the canvas.
<img width="853" alt="image" src="https://github.com/user-attachments/assets/fd8a9800-2e95-40e1-b10f-a8b060fa61bb">


5. Next you will need to add a RestAPI that returns an array of suggestions for your bot. For testing, you can use the TypeAheadSolutionAPI Zip file that has a power automate flow that returns topic names for a given copilot bot. On the power automate flow you will need to edit the list row action and replace the exisiting botid with your botid.

<img width="731" alt="image" src="https://github.com/user-attachments/assets/628fa504-e534-4e5c-bd03-29fa351d96bf">




7. On line 222 Add your RestAPI endpoint that returns an array of suggested topics.
   <img width="830" alt="image" src="https://github.com/user-attachments/assets/58f1608e-c87f-42e9-b8de-547142edefe6">

   
8. Optional : If you would like to exclude any suggestions based on your business logic you can create a exclusion list as shown below on line 173.
   <img width="306" alt="image" src="https://github.com/user-attachments/assets/c7abb501-e3f4-4e67-a6d4-c7852fadca4a">
   
9. Click Save and open the file in the browser to test. You can launch the bot by clicking on the chat bubble and initiating the chat.

10. To see list of suggestions before typying click the space bar which opens a dropdow list of suggested topcis
    
11. For getting type ahead suggestions continue to type in the chat bot canvas and suggestions will be shown below the chat area. Clicking on any suggestion submits the utterance to the bot.

# Watch below Demo to Get Started with Version 1

[![Watch the video](https://th.bing.com/th/id/OIP.9k6Gz3sbmi5b8r6YxTSG-QHaEK?w=289&h=180&c=7&r=0&o=5&dpr=1.5&pid=1.7
)](https://www.youtube.com/watch?v=7xbSpzmQcIg)

https://www.youtube.com/watch?v=7xbSpzmQcIg
# Watch below Demo to Get Started with Version 2
[![Watch the video](https://microsoft-my.sharepoint.com/:v:/p/paragdessai/ETkn3PA1l15Fhya-wCo6ENQB-Da9lRknTh9tZzysqxZsLQ?e=b3bDMI&nav=eyJyZWZlcnJhbEluZm8iOnsicmVmZXJyYWxBcHAiOiJTdHJlYW1XZWJBcHAiLCJyZWZlcnJhbFZpZXciOiJTaGFyZURpYWxvZy1MaW5rIiwicmVmZXJyYWxBcHBQbGF0Zm9ybSI6IldlYiIsInJlZmVycmFsTW9kZSI6InZpZXcifX0%3D)




   
