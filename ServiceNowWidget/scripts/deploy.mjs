#!/usr/bin/env node

/**
 * Automated deployment of the Copilot Chat widget to a ServiceNow instance.
 *
 * Uses the ServiceNow Table API + Attachment API with Node 18+ built-in fetch.
 * Zero npm dependencies beyond what the project already has.
 *
 * Usage:
 *   cp scripts/deploy-config.sample.json scripts/deploy-config.json
 *   # edit deploy-config.json with your instance details
 *   node scripts/deploy.mjs
 */

import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');
const CONFIG_PATH = resolve(__dirname, 'deploy-config.json');
const BUNDLE_PATH = resolve(PROJECT_ROOT, 'dist', 'copilot-chat.js');

const WEBCHAT_CDN = 'https://unpkg.com/botframework-webchat@4.18.0/dist/webchat.js';
const MSAL_CDN = 'https://unpkg.com/@azure/msal-browser@4.13.1/lib/msal-browser.js';

// Widget source files
const WIDGET_HTML_PATH = resolve(PROJECT_ROOT, 'servicenow', 'widget-html.html');
const WIDGET_CLIENT_PATH = resolve(PROJECT_ROOT, 'servicenow', 'widget-client.js');
const WIDGET_CSS_PATH = resolve(PROJECT_ROOT, 'servicenow', 'widget-css.scss');

// ─── Helpers ───────────────────────────────────────────────────────────────────

function log(step, msg) {
  console.log(`[${step}] ${msg}`);
}

function die(msg, code = 1) {
  console.error(`\nERROR: ${msg}`);
  process.exit(code);
}

async function promptPassword() {
  return new Promise((resolve) => {
    process.stderr.write('ServiceNow password: ');
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    let pw = '';
    const onData = (chunk) => {
      const str = chunk.toString();
      for (const ch of str) {
        if (ch === '\n' || ch === '\r') {
          if (process.stdin.isTTY) process.stdin.setRawMode(false);
          process.stderr.write('\n');
          process.stdin.removeListener('data', onData);
          resolve(pw);
          return;
        } else if (ch === '\x7f' || ch === '\b') {
          pw = pw.slice(0, -1);
        } else if (ch === '\x03') {
          process.exit(130);
        } else {
          pw += ch;
        }
      }
    };
    process.stdin.on('data', onData);
    process.stdin.resume();
  });
}

// ─── ServiceNow API client ────────────────────────────────────────────────────

class ServiceNowClient {
  constructor(instance, username, password) {
    this.baseUrl = instance.replace(/\/+$/, '');
    this.auth = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
  }

  async request(method, path, body = null, extraHeaders = {}) {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      Authorization: this.auth,
      Accept: 'application/json',
      ...extraHeaders,
    };
    if (body && typeof body === 'object' && !Buffer.isBuffer(body)) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(body);
    }
    const res = await fetch(url, { method, headers, body });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`${method} ${path} → ${res.status} ${res.statusText}\n${text}`);
    }
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) return res.json();
    return res.text();
  }

  /** Query a table. Returns array of records. */
  async query(table, query, fields = []) {
    let path = `/api/now/table/${table}?sysparm_query=${encodeURIComponent(query)}&sysparm_limit=1`;
    if (fields.length) path += `&sysparm_fields=${fields.join(',')}`;
    const data = await this.request('GET', path);
    return data.result || [];
  }

  /** Create a record. Returns the created record. */
  async create(table, record) {
    const data = await this.request('POST', `/api/now/table/${table}`, record);
    return data.result;
  }

  /** Upload a file attachment to a record. */
  async uploadAttachment(table, sysId, fileName, fileBuffer, contentType = 'application/javascript') {
    const path = `/api/now/attachment/file?table_name=${table}&table_sys_id=${sysId}&file_name=${encodeURIComponent(fileName)}`;
    const data = await this.request('POST', path, fileBuffer, {
      'Content-Type': contentType,
    });
    return data.result;
  }
}

// ─── Deployment steps ──────────────────────────────────────────────────────────

async function ensureBundle() {
  if (existsSync(BUNDLE_PATH)) {
    log('build', `Bundle exists: ${BUNDLE_PATH}`);
    return;
  }
  log('build', 'Bundle not found — running npm run build...');
  execSync('npm run build', { cwd: PROJECT_ROOT, stdio: 'inherit' });
  if (!existsSync(BUNDLE_PATH)) {
    die('Build did not produce dist/copilot-chat.js');
  }
}

async function ensureSystemProperties(client, agentConfig) {
  const props = {
    'copilot.chat.environmentId': agentConfig.environmentId,
    'copilot.chat.agentIdentifier': agentConfig.agentIdentifier,
    'copilot.chat.tenantId': agentConfig.tenantId,
    'copilot.chat.appClientId': agentConfig.appClientId,
    'copilot.chat.headerTitle': agentConfig.headerTitle || 'Chat with us',
    'copilot.chat.webchatCdnUrl': WEBCHAT_CDN,
    'copilot.chat.msalCdnUrl': MSAL_CDN,
  };

  for (const [name, value] of Object.entries(props)) {
    const existing = await client.query('sys_properties', `name=${name}`, ['sys_id', 'name', 'value']);
    if (existing.length > 0) {
      if (existing[0].value !== value) {
        await client.request('PATCH', `/api/now/table/sys_properties/${existing[0].sys_id}`, { value });
        log('props', `Updated ${name} (${existing[0].sys_id})`);
      } else {
        log('props', `Property ${name} unchanged (${existing[0].sys_id})`);
      }
      continue;
    }
    const record = await client.create('sys_properties', {
      name,
      value,
      description: 'Copilot Chat widget configuration',
      type: 'string',
    });
    log('props', `Created property ${name} (${record.sys_id})`);
  }
}

async function ensureWidget(client) {
  const WIDGET_ID = 'copilot-chat';
  // Read widget source files
  const htmlBody = existsSync(WIDGET_HTML_PATH) ? readFileSync(WIDGET_HTML_PATH, 'utf-8') : '';
  const clientScript = existsSync(WIDGET_CLIENT_PATH) ? readFileSync(WIDGET_CLIENT_PATH, 'utf-8') : '';
  const css = existsSync(WIDGET_CSS_PATH) ? readFileSync(WIDGET_CSS_PATH, 'utf-8') : '';

  // Server script uses gs.getProperty() — read from system properties
  const serverScript = `(function () {
  data.config = {
    environmentId: gs.getProperty('copilot.chat.environmentId'),
    agentIdentifier: gs.getProperty('copilot.chat.agentIdentifier'),
    tenantId: gs.getProperty('copilot.chat.tenantId'),
    appClientId: gs.getProperty('copilot.chat.appClientId'),
    headerTitle: gs.getProperty('copilot.chat.headerTitle', 'Chat with us'),
  };
  data.bundleUrl = gs.getProperty('copilot.chat.bundleUrl');
  data.webchatCdnUrl = gs.getProperty('copilot.chat.webchatCdnUrl',
    'https://unpkg.com/botframework-webchat@4.18.0/dist/webchat.js');
  data.msalCdnUrl = gs.getProperty('copilot.chat.msalCdnUrl',
    'https://unpkg.com/@azure/msal-browser@4.13.1/lib/msal-browser.js');
})();`;

  const widgetFields = {
    template: htmlBody,
    client_script: clientScript,
    script: serverScript,
    css,
  };

  const existing = await client.query('sp_widget', `id=${WIDGET_ID}`, ['sys_id', 'id', 'name']);
  if (existing.length > 0) {
    await client.request('PATCH', `/api/now/table/sp_widget/${existing[0].sys_id}`, widgetFields);
    log('widget', `Updated widget "${WIDGET_ID}" (${existing[0].sys_id})`);
    return existing[0].sys_id;
  }

  const record = await client.create('sp_widget', {
    id: WIDGET_ID,
    name: 'Copilot Chat',
    ...widgetFields,
  });
  log('widget', `Created widget "Copilot Chat" (${record.sys_id})`);
  return record.sys_id;
}

async function uploadBundle(client, widgetSysId) {
  // Check if bundle attachment already exists on this widget
  const existing = await client.query(
    'sys_attachment',
    `table_name=sp_widget^table_sys_id=${widgetSysId}^file_name=copilot-chat.js`,
    ['sys_id'],
  );
  if (existing.length > 0) {
    log('upload', `Bundle attachment already exists (${existing[0].sys_id}) — replacing`);
    await client.request('DELETE', `/api/now/attachment/${existing[0].sys_id}`);
    log('upload', 'Deleted old attachment');
  }

  const bundleBuffer = readFileSync(BUNDLE_PATH);
  const attachment = await client.uploadAttachment('sp_widget', widgetSysId, 'copilot-chat.js', bundleBuffer);
  const attachmentSysId = attachment.sys_id;
  const attachmentUrl = `/sys_attachment.do?sys_id=${attachmentSysId}`;
  log('upload', `Uploaded bundle as attachment (${attachmentSysId})`);

  // Update the system property to point to the attachment URL
  const prop = await client.query('sys_properties', 'name=copilot.chat.bundleUrl', ['sys_id']);
  if (prop.length > 0) {
    await client.request('PATCH', `/api/now/table/sys_properties/${prop[0].sys_id}`, {
      value: attachmentUrl,
    });
    log('upload', `Updated copilot.chat.bundleUrl → ${attachmentUrl}`);
  } else {
    await client.create('sys_properties', {
      name: 'copilot.chat.bundleUrl',
      value: attachmentUrl,
      description: 'Copilot Chat widget configuration',
      type: 'string',
    });
    log('upload', `Created copilot.chat.bundleUrl → ${attachmentUrl}`);
  }

  return attachmentSysId;
}

async function ensureJsIncludes(client, bundleAttachmentSysId) {
  const bundleUrl = `/sys_attachment.do?sys_id=${bundleAttachmentSysId}`;
  const includes = [
    { label: 'MSAL', source: 'url', url: MSAL_CDN },
    { label: 'WebChat', source: 'url', url: WEBCHAT_CDN },
    { label: 'Bundle', source: 'url', url: bundleUrl },
  ];

  const sysIds = [];
  for (const inc of includes) {
    // Query by exact URL match — sp_js_include has no "name" field
    const existing = await client.query('sp_js_include', `url=${inc.url}`, ['sys_id', 'url']);
    if (existing.length > 0) {
      log('includes', `JS Include "${inc.label}" already exists (${existing[0].sys_id})`);
      sysIds.push(existing[0].sys_id);
      continue;
    }

    // For the bundle, also check if an old attachment URL exists (re-deploy scenario)
    if (inc.label === 'Bundle') {
      const oldBundle = await client.query('sp_js_include', 'urlLIKE/sys_attachment.do?sys_id=', ['sys_id', 'url']);
      if (oldBundle.length > 0) {
        await client.request('PATCH', `/api/now/table/sp_js_include/${oldBundle[0].sys_id}`, {
          url: inc.url,
        });
        log('includes', `Updated JS Include "${inc.label}" URL (${oldBundle[0].sys_id})`);
        sysIds.push(oldBundle[0].sys_id);
        continue;
      }
    }

    const record = await client.create('sp_js_include', {
      source: inc.source,
      url: inc.url,
    });
    log('includes', `Created JS Include "${inc.label}" (${record.sys_id})`);
    sysIds.push(record.sys_id);
  }
  return sysIds;
}

async function ensureDependency(client) {
  const DEP_NAME = 'Copilot Chat Dependencies';
  const existing = await client.query('sp_dependency', `name=${DEP_NAME}`, ['sys_id', 'name']);
  if (existing.length > 0) {
    log('dep', `Widget Dependency "${DEP_NAME}" already exists (${existing[0].sys_id})`);
    return existing[0].sys_id;
  }
  const record = await client.create('sp_dependency', {
    name: DEP_NAME,
    include_on_page_load: true,
  });
  log('dep', `Created Widget Dependency "${DEP_NAME}" (${record.sys_id})`);
  return record.sys_id;
}

async function linkJsIncludesToDependency(client, dependencySysId, jsIncludeSysIds) {
  for (let i = 0; i < jsIncludeSysIds.length; i++) {
    const jsIncSysId = jsIncludeSysIds[i];
    const order = (i + 1) * 100;
    const existing = await client.query(
      'm2m_sp_dependency_js_include',
      `sp_dependency=${dependencySysId}^sp_js_include=${jsIncSysId}`,
      ['sys_id'],
    );
    if (existing.length > 0) {
      log('link', `JS Include already linked to dependency (${existing[0].sys_id})`);
      continue;
    }
    const record = await client.create('m2m_sp_dependency_js_include', {
      sp_dependency: dependencySysId,
      sp_js_include: jsIncSysId,
      order,
    });
    log('link', `Linked JS Include → Dependency with order ${order} (${record.sys_id})`);
  }
}

async function linkWidgetToDependency(client, widgetSysId, dependencySysId) {
  const existing = await client.query(
    'm2m_sp_widget_dependency',
    `sp_widget=${widgetSysId}^sp_dependency=${dependencySysId}`,
    ['sys_id'],
  );
  if (existing.length > 0) {
    log('link', `Widget already linked to dependency (${existing[0].sys_id})`);
    return;
  }
  const record = await client.create('m2m_sp_widget_dependency', {
    sp_widget: widgetSysId,
    sp_dependency: dependencySysId,
  });
  log('link', `Linked Widget → Dependency (${record.sys_id})`);
}

async function placeWidgetOnPortal(client, widgetSysId, portalConfig) {
  if (!portalConfig?.placeOnPortal) {
    log('portal', 'Skipping portal placement (placeOnPortal is false)');
    return;
  }

  const urlSuffix = portalConfig.urlSuffix || 'sp';

  // Check if widget instance already exists for THIS widget
  const existingInstances = await client.query(
    'sp_instance',
    `widget=${widgetSysId}^widgetISNOTEMPTY`,
    ['sys_id', 'widget'],
  );
  // Verify the match actually references our widget (ServiceNow can match empty refs)
  const realMatch = existingInstances.find((inst) => inst.widget?.value === widgetSysId);
  if (realMatch) {
    log('portal', `Widget instance already exists on a page (${realMatch.sys_id})`);
    return;
  }

  // Find the portal
  const portals = await client.query('sp_portal', `url_suffix=${urlSuffix}`, ['sys_id', 'homepage']);
  if (portals.length === 0) {
    log('portal', `No portal found with url_suffix="${urlSuffix}" — skipping placement`);
    return;
  }
  const homepageSysId = portals[0].homepage?.value || portals[0].homepage;
  if (!homepageSysId) {
    log('portal', 'Portal has no homepage configured — skipping placement');
    return;
  }

  // Find a container on the homepage
  const containers = await client.query(
    'sp_container',
    `sp_page=${homepageSysId}`,
    ['sys_id', 'order'],
  );
  let containerSysId;
  if (containers.length > 0) {
    containerSysId = containers[0].sys_id;
  } else {
    const container = await client.create('sp_container', {
      sp_page: homepageSysId,
      order: 900,
      name: 'Copilot Chat Container',
    });
    containerSysId = container.sys_id;
    log('portal', `Created container (${containerSysId})`);
  }

  // Find or create a row
  const rows = await client.query('sp_row', `sp_container=${containerSysId}`, ['sys_id']);
  let rowSysId;
  if (rows.length > 0) {
    rowSysId = rows[0].sys_id;
  } else {
    const row = await client.create('sp_row', { sp_container: containerSysId });
    rowSysId = row.sys_id;
    log('portal', `Created row (${rowSysId})`);
  }

  // Find or create a column
  const columns = await client.query('sp_column', `sp_row=${rowSysId}`, ['sys_id']);
  let columnSysId;
  if (columns.length > 0) {
    columnSysId = columns[0].sys_id;
  } else {
    const col = await client.create('sp_column', { sp_row: rowSysId, size: 12 });
    columnSysId = col.sys_id;
    log('portal', `Created column (${columnSysId})`);
  }

  // Create widget instance
  const instance = await client.create('sp_instance', {
    widget: widgetSysId,
    sp_column: columnSysId,
    order: 900,
  });
  log('portal', `Placed widget on portal homepage (${instance.sys_id})`);
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function confirm(message) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stderr });
    rl.question(message, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

async function main() {
  console.log('\n=== Copilot Chat — ServiceNow Deployment ===\n');

  console.log('This script will create or update the following records on your ServiceNow instance:');
  console.log('  - System properties (copilot.chat.*)');
  console.log('  - Widget (sp_widget) with HTML, client script, server script, CSS');
  console.log('  - Bundle uploaded as attachment');
  console.log('  - JS Include records (sp_js_include)');
  console.log('  - Widget Dependency (sp_dependency) with M2M links');
  console.log('  - Widget instance on portal homepage (optional)\n');
  console.log('Review scripts/deploy-config.json before proceeding.\n');

  const ok = await confirm('Continue? (y/n) ');
  if (!ok) {
    console.log('Aborted.');
    process.exit(0);
  }
  console.log('');

  // 1. Load config
  if (!existsSync(CONFIG_PATH)) {
    die(
      `Config file not found: scripts/deploy-config.json\n` +
      `Copy the sample and fill in your values:\n` +
      `  cp scripts/deploy-config.sample.json scripts/deploy-config.json`,
    );
  }
  const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));

  // Validate required fields
  const required = ['instance', 'username'];
  for (const field of required) {
    if (!config[field]) die(`Missing required config field: ${field}`);
  }
  if (!config.agent?.environmentId) die('Missing config field: agent.environmentId');
  if (!config.agent?.agentIdentifier) die('Missing config field: agent.agentIdentifier');
  if (!config.agent?.tenantId) die('Missing config field: agent.tenantId');
  if (!config.agent?.appClientId) die('Missing config field: agent.appClientId');

  // Prompt for password if not in config
  let password = config.password;
  if (!password) {
    password = await promptPassword();
    if (!password) die('Password is required');
  }

  const client = new ServiceNowClient(config.instance, config.username, password);

  // 2. Ensure bundle exists
  log('1/8', 'Checking bundle...');
  await ensureBundle();

  // 3. Create system properties
  log('2/8', 'Creating system properties...');
  await ensureSystemProperties(client, config.agent);

  // 4. Create widget
  log('3/8', 'Creating widget...');
  const widgetSysId = await ensureWidget(client);

  // 5. Upload bundle as attachment
  log('4/8', 'Uploading bundle...');
  const attachmentSysId = await uploadBundle(client, widgetSysId);

  // 6. Create JS Includes
  log('5/8', 'Creating JS Includes...');
  const jsIncludeSysIds = await ensureJsIncludes(client, attachmentSysId);

  // 7. Create Widget Dependency
  log('6/8', 'Creating Widget Dependency...');
  const dependencySysId = await ensureDependency(client);

  // 8. Link JS Includes → Dependency and Widget → Dependency
  log('7/8', 'Linking records...');
  await linkJsIncludesToDependency(client, dependencySysId, jsIncludeSysIds);
  await linkWidgetToDependency(client, widgetSysId, dependencySysId);

  // 9. Place widget on portal page
  log('8/8', 'Placing widget on portal...');
  await placeWidgetOnPortal(client, widgetSysId, config.portal);

  // Summary
  const portalUrl = `${config.instance}/${config.portal?.urlSuffix || 'sp'}`;
  console.log('\n=== Deployment Complete ===\n');
  console.log(`  Portal URL:  ${portalUrl}`);
  console.log(`  Widget:      ${config.instance}/nav_to.do?uri=sp_widget.do?sysparm_query=id=copilot-chat`);
  console.log(`  Properties:  ${config.instance}/nav_to.do?uri=sys_properties_list.do?sysparm_query=nameLIKEcopilot.chat`);
  console.log('');
  console.log('Open the portal URL to verify the chat bubble appears.\n');
}

main().catch((err) => {
  console.error('\nDeployment failed:', err.message || err);
  process.exit(2);
});
