/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import {
  CopilotStudioClient,
  CopilotStudioWebChat
} from '@microsoft/agents-copilotstudio-client'

import { acquireToken } from './acquireToken.js'
import { settings } from './agent.settings.js';

const token = await acquireToken(settings);
const client = new CopilotStudioClient(settings, token);
const connection = CopilotStudioWebChat.createConnection(client, { typingIndicator: true });

await client.startConversationAsync(true);

window.WebChat.renderWebChat(
  {
    directLine: connection,      
  },
  document.getElementById('webchat')
);
document.querySelector('#webchat > *').focus();
document.querySelector('#loadingPane').style.display = 'none';

const params = new URLSearchParams(new URLSearchParams(window.location.search).get('data'));
var recordType = params.get('recordType');
var id = params.get('id');

var contextActivity = { 
  type: "event", 
  name: "SidePaneAgent.InitializeContext", 
  value: { 
    recordtype: recordType,
    recordid: id
  } 
};

console.log("Sending context via event: ", contextActivity);
var response = await client.sendActivity(contextActivity);
console.log("Context event sent response: ", response[0].text);