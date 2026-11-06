function validateProperties(properties) {
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
    throw new Error('Properties must be a JSON object.');
  }
  const strings = [
    'appClientId', 'tenantId', 'environmentId', 'schemaName', 'agentIdentifier', 'directConnectUrl',
    'agentTitle', 'headerBackgroundColor'
  ];
  const flags = ['startConversation', 'showTyping', 'enableFileUpload', 'showReasoning', 'showToolCalls'];
  const allowed = [...strings, ...flags, 'starterPrompts'];
  for (const key of Object.keys(properties)) {
    if (!allowed.includes(key)) throw new Error(`Unknown property "${key}". Never put credentials in extension properties.`);
  }
  for (const key of strings) {
    if (properties[key] !== undefined && typeof properties[key] !== 'string') throw new Error(`${key} must be a string.`);
  }
  if (!properties.appClientId?.trim() || !properties.tenantId?.trim() ||
      !(properties.directConnectUrl?.trim() ||
        (properties.environmentId?.trim() && (properties.schemaName?.trim() || properties.agentIdentifier?.trim())))) {
    throw new Error('Provide appClientId, tenantId, and environmentId/schemaName (or an explicit directConnectUrl).');
  }
  if (properties.directConnectUrl) {
    const url = new URL(properties.directConnectUrl);
    if (url.protocol !== 'https:' || url.username || url.password || url.hash) {
      throw new Error('directConnectUrl must be an HTTPS URL without credentials or a fragment.');
    }
  }
  for (const flag of flags) {
    if (properties[flag] !== undefined && typeof properties[flag] !== 'boolean') throw new Error(`${flag} must be a boolean.`);
  }
  if (properties.starterPrompts !== undefined) {
    if (!Array.isArray(properties.starterPrompts) || properties.starterPrompts.some(prompt =>
      !prompt || typeof prompt !== 'object' || Array.isArray(prompt) ||
      Object.keys(prompt).some(key => key !== 'title' && key !== 'text') ||
      typeof prompt.title !== 'string' || !prompt.title.trim() || typeof prompt.text !== 'string' || !prompt.text.trim()
    )) throw new Error('starterPrompts must be an array of objects containing only a non-empty title and text.');
  }
  return properties;
}

module.exports = { validateProperties };
