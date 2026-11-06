const { readFileSync } = require('node:fs');
const { validateProperties } = require('./properties.cjs');

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
  validateProperties(properties);
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
