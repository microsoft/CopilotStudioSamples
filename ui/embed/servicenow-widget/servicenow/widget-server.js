(function () {
  data.config = {
    environmentId: gs.getProperty('copilot.chat.environmentId'),
    agentIdentifier: gs.getProperty('copilot.chat.agentIdentifier'),
    tenantId: gs.getProperty('copilot.chat.tenantId'),
    appClientId: gs.getProperty('copilot.chat.appClientId'),
    headerTitle: gs.getProperty('copilot.chat.headerTitle', 'Chat with us'),
  };
  data.webchatCdnUrl = gs.getProperty('copilot.chat.webchatCdnUrl',
    'https://unpkg.com/botframework-webchat@4.18.0/dist/webchat.js');
  data.msalCdnUrl = gs.getProperty('copilot.chat.msalCdnUrl',
    'https://unpkg.com/@azure/msal-browser@4.13.1/lib/msal-browser.js');
})();
