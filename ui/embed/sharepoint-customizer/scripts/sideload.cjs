const { readFileSync } = require('node:fs');

const COMPONENT_ID = '4c6e29f2-7eee-4f9f-bbd2-20c8859d0ba2';

function createSideloadUrl(pageUrl, properties, manifestUrl = 'https://localhost:4321/temp/build/manifests.js') {
  const page = new URL(pageUrl);
  const manifest = new URL(manifestUrl);
  if (page.protocol !== 'https:' || page.username || page.password) {
    throw new Error('The SharePoint page must be an HTTPS URL without credentials.');
  }
  if (manifest.protocol !== 'https:' || manifest.username || manifest.password) {
    throw new Error('The development manifest must be an HTTPS URL without credentials.');
  }
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
    throw new Error('Properties must be a JSON object.');
  }
  const allowed = [
    'appClientId', 'tenantId', 'environmentId', 'schemaName', 'agentIdentifier', 'directConnectUrl',
    'startConversation', 'showTyping', 'enableFileUpload', 'showReasoning', 'showToolCalls',
    'agentTitle', 'headerBackgroundColor', 'starterPrompts'
  ];
  for (const key of Object.keys(properties)) {
    if (!allowed.includes(key)) throw new Error(`Unknown property "${key}". Never put credentials in a debug URL.`);
  }
  if (!properties.appClientId || !properties.tenantId ||
      !(properties.directConnectUrl || (properties.environmentId && (properties.schemaName || properties.agentIdentifier)))) {
    throw new Error('Provide appClientId, tenantId, and environmentId/schemaName (or an explicit directConnectUrl).');
  }
  for (const flag of ['startConversation', 'showTyping', 'enableFileUpload', 'showReasoning', 'showToolCalls']) {
    if (properties[flag] !== undefined && typeof properties[flag] !== 'boolean') throw new Error(`${flag} must be a boolean.`);
  }
  if (properties.starterPrompts !== undefined) {
    if (!Array.isArray(properties.starterPrompts) || properties.starterPrompts.some(prompt =>
      !prompt || typeof prompt !== 'object' || Array.isArray(prompt) ||
      Object.keys(prompt).some(key => key !== 'title' && key !== 'text') ||
      typeof prompt.title !== 'string' || !prompt.title.trim() || typeof prompt.text !== 'string' || !prompt.text.trim()
    )) throw new Error('starterPrompts must be an array of objects containing only a non-empty title and text.');
  }
  page.searchParams.set('loadSPFX', 'true');
  page.searchParams.set('debugManifestsFile', manifest.href);
  page.searchParams.set('customActions', JSON.stringify({
    [COMPONENT_ID]: { location: 'ClientSideExtension.ApplicationCustomizer', properties }
  }));
  return page.href;
}

if (require.main === module) {
  try {
    const [page, file, manifest] = process.argv.slice(2);
    if (!page || !file) throw new Error('Usage: npm run sideload -- <SharePoint-page-URL> <properties.local.json> [HTTPS-manifest-URL]');
    console.log(createSideloadUrl(page, JSON.parse(readFileSync(file, 'utf8')), manifest));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { createSideloadUrl, COMPONENT_ID };
