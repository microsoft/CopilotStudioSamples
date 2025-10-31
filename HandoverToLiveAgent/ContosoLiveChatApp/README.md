# Contoso Live Chat App

A simple ASP.NET Core live chat application with webhook integration.

## Features

- Real-time chat interface with message history
- Send messages to a preconfigured webhook endpoint
- Receive messages from remote parties via POST endpoint
- Clean, modern UI with responsive design
- In-memory message storage

## Project Structure

```
ContosoLiveChatApp/
├── Controllers/
│   └── ChatController.cs          # API endpoints for chat operations
├── Models/
│   └── ChatMessage.cs             # Chat message data model
├── Services/
│   ├── ChatService.cs             # In-memory chat history management
│   └── WebhookService.cs          # Outgoing webhook sender
├── wwwroot/
│   └── index.html                 # Chat UI
├── Program.cs                     # Application entry point
├── appsettings.json              # Configuration (webhook URL)
└── ContosoLiveChatApp.csproj     # Project file
```

## Configuration

**⚠️ IMPORTANT:** Before running the application, you **must** configure a valid webhook URL in `appsettings.json`:

```json
{
  "WebhookSettings": {
    "OutgoingWebhookUrl": "https://your-webhook-endpoint.com/api/messages"
  }
}
```

Replace `https://your-webhook-endpoint.com/api/messages` with your actual webhook endpoint URL.

**The application will not start if:**
- The webhook URL is not set (empty or null)
- The webhook URL is still set to the default placeholder value

This validation ensures you don't accidentally run the application with an invalid webhook configuration.

## Running the Application

1. Navigate to the project directory:
```powershell
cd CopilotStudioSamples\HandoverToLiveAgent\ContosoLiveChatApp
```

2. Restore dependencies and run:
```powershell
dotnet run
```

3. Open your browser and navigate to:
```
http://localhost:5000
```

## API Endpoints

### 1. Get All Messages
- **Endpoint**: `GET /api/chat/messages`
- **Description**: Retrieves all chat messages
- **Response**: Array of ChatMessage objects

### 2. Send Message
- **Endpoint**: `POST /api/chat/send`
- **Description**: Sends a message from the user (forwards to webhook)
- **Request Body**:
```json
{
  "text": "Your message here"
}
```
- **Response**:
```json
{
  "message": "Message sent successfully",
  "messageId": "guid"
}
```

### 3. Receive Message
- **Endpoint**: `POST /api/chat/receive`
- **Description**: Receives incoming messages from remote parties
- **Request Body**:
```json
{
  "text": "Incoming message",
  "sender": "Remote Party Name"
}
```
- **Response**:
```json
{
  "message": "Message received successfully",
  "messageId": "guid"
}
```

## Usage

### Sending Messages (User Interface)
1. Type your message in the input field at the bottom
2. Click the "Send" button or press Enter
3. The message will be displayed in the chat history
4. The message will be sent to the configured webhook endpoint

### Receiving Messages (Via API)
Remote parties can send messages to your chat by making a POST request to:
```
POST http://localhost:5000/api/chat/receive
Content-Type: application/json

{
  "text": "Hello from remote party",
  "sender": "Agent Name"
}
```

The message will automatically appear in the chat history.

## Testing the Webhook

To test the webhook functionality without a real endpoint, you can use services like:
- [webhook.site](https://webhook.site) - Provides a temporary webhook URL
- [RequestBin](https://requestbin.com) - Inspect HTTP requests
- [ngrok](https://ngrok.com) - Create a tunnel to your local machine

## Notes

- Messages are stored in-memory and will be lost when the application restarts
- The chat automatically polls for new messages every 2 seconds
- The UI is responsive and works on mobile devices
- All timestamps are in UTC

## Future Enhancements

Consider adding:
- Database persistence for messages
- WebSocket/SignalR for real-time updates
- User authentication
- Message delivery confirmation
- File attachments support
- Typing indicators
