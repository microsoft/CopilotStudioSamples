// Import required packages
import { startServer } from "@microsoft/agents-hosting-express";


// This bot's main dialog.
import { agentApp } from "./agent";



// Start the server with streaming support
startServer(agentApp);