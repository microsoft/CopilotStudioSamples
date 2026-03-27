api.controller = function ($scope, $element) {
  var config = this.data.config;
  if (!config || !config.environmentId) {
    console.error('CopilotChat: No config from server script. Check system properties.');
    return;
  }
  if (typeof window.CopilotChat === 'undefined') {
    console.error('CopilotChat: Bundle not loaded. Check Widget Dependencies.');
    return;
  }
  window.CopilotChat.init(document.body, config);
};
