# Typeahed Suggestions for Copilot Studio 
This code sample allows you to create a typeahead suggestion functionality for your custome copilot that can assist users finding things like frequently asked questions, auto correcting typos and showing a list of menu items like product names or topic names before sending a message to the copilot.



## Getting Started

1. Create your custom copilot using copilot studio with required topics and actions.
2. Once you have published your copilot go to settings>security>Web Channel Security and copy your secret.
3. Download the TypeAheadSuggestion.HTML canvas to your local machine and open in any code editor.
4. On line 155 replace add the secret your copied for your copilot. Please note that for best practices you can use directline token instead of using secret in the canvas.
<img width="499" alt="image" src="https://github.com/user-attachments/assets/0132ca26-3222-47be-8fc4-0165f333044c">
5. Next you need to add a RestAPI that returns an array of suggestions for your bot. You can use the
6. On line 193 Add your RestAPI endpoint that returns an array of suggested topics.
   <img width="863" alt="image" src="https://github.com/user-attachments/assets/3263019e-db5a-46ba-8c96-72179df506a9">
7. Optional : If you would like to exclude any suggestions based on your business logic you can create a exclusion list as shown below on line 173.
   <img width="306" alt="image" src="https://github.com/user-attachments/assets/c7abb501-e3f4-4e67-a6d4-c7852fadca4a">
8. Click Save and open the file in the browser to test. You can launch the bot by clicking on the chat bubble and initiating the chat.
9. To see list of suggestions before typying click the space bar which opens a dropdow list of suggested topcis
10. For getting type ahead suggestions continue to type in the chat bot canvas and suggestions will be shown below the chat area. Clicking on any suggestion submits the utterance to the bot.

# Watch below Demo to Get Started

[![Watch the video](https://img.youtube.com/vi/VIDEO_ID/maxresdefault.jpg)](https://www.youtube.com/watch?v=7xbSpzmQcIg)

https://www.youtube.com/watch?v=7xbSpzmQcIg



   
