const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { parseArgs, isDeepStrictEqual } = require('node:util');
const { createHash, randomUUID } = require('node:crypto');
const { unzipSync, strFromU8 } = require('fflate');
const { validateProperties } = require('./properties.cjs');

const ROOT = path.resolve(__dirname, '..');
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOCATION = 'ClientSideExtension.ApplicationCustomizer';
const HELP = `Deploy the SharePoint sidepane to one site (Node 22, Windows/macOS/Linux).

npm run deploy -- --site-url <HTTPS-site> --app-catalog-url <HTTPS-tenant-catalog> --app-client-id <SPA-client-GUID> --properties <JSON-file>

--app-client-id  Existing sidepane SPA registration; overrides appClientId in JSON.
--properties     Tenant/agent settings and optional UI flags, never credentials.
--site-url       Target site; also the SPA redirect URI, without a trailing slash.
--app-catalog-url Existing tenant app catalog. Required only for live deployment.
--dry-run        Validate and describe the plan; no build, login, or remote calls.
--package-only   Build and inspect the configured .sppkg; no login or remote calls.
--replace        Authorize replacing a different catalog package with a NEWER version.
--help           Show this help.

Live deployment reuses your existing m365 login to the explicit tenant GUID.
The deployer's app/permissions are separate from the sidepane SPA registration.
The script never logs in, grants permissions, or enables tenant-wide activation.
Catalog replacement can affect other installations. Bump solution/feature versions
before deploying changed code or packaged defaults. Identical packages are reused.
Failures stop deployment and report completed remote operations; no automatic rollback.`;

function siteUrl(value, name) {
  if (!value) throw new Error(`${name} is required.`);
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
      url.port || !/\.sharepoint\.(com|us|de|cn)$/i.test(url.hostname) ||
      /(?:^|\/)_layouts(?:\/|$)|\.aspx$/i.test(url.pathname)) {
    throw new Error(`${name} must be a SharePoint HTTPS site URL, not a page, debug link, or URL with credentials.`);
  }
  return url.href.replace(/\/+$/, '');
}

function guid(value, name) {
  if (typeof value !== 'string' || !GUID.test(value)) throw new Error(`${name} must be a GUID, not a placeholder.`);
  return value.toLowerCase();
}

async function readJson(file) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch (error) { throw new Error(`Cannot read JSON from ${file}: ${error.message}`); }
}

async function loadOptions(argv, cwd = process.cwd(), root = ROOT) {
  const { values } = parseArgs({
    args: argv, allowPositionals: false,
    options: {
      'site-url': { type: 'string' }, 'app-catalog-url': { type: 'string' },
      'app-client-id': { type: 'string' }, properties: { type: 'string' },
      'dry-run': { type: 'boolean' }, 'package-only': { type: 'boolean' },
      replace: { type: 'boolean' }, help: { type: 'boolean' }
    }
  });
  if (values.help) return { help: true };
  if (values['dry-run'] && values['package-only']) throw new Error('Choose --dry-run or --package-only, not both.');
  if (!values.properties) throw new Error('--properties is required.');
  const fileProperties = await readJson(path.resolve(cwd, values.properties));
  if (!fileProperties || Array.isArray(fileProperties) || typeof fileProperties !== 'object') {
    throw new Error('Properties must be a JSON object.');
  }
  const properties = validateProperties({ ...fileProperties, appClientId: guid(values['app-client-id'], '--app-client-id') });
  properties.tenantId = guid(properties.tenantId, 'tenantId');
  if (properties.environmentId) properties.environmentId = guid(properties.environmentId, 'environmentId');
  for (const name of ['schemaName', 'agentIdentifier', 'directConnectUrl']) {
    if (properties[name]?.includes('YOUR_')) throw new Error(`Replace the ${name} placeholder.`);
  }
  const target = siteUrl(values['site-url'], '--site-url');
  const catalog = values['app-catalog-url'] ? siteUrl(values['app-catalog-url'], '--app-catalog-url') : undefined;
  if (!catalog && !values['package-only'] && !values['dry-run']) throw new Error('--app-catalog-url is required for live deployment.');
  if (catalog && new URL(catalog).hostname !== new URL(target).hostname) {
    throw new Error('The site and tenant app catalog must be on the same SharePoint host.');
  }
  const metadata = await readJson(path.join(root, 'config/package-solution.json'));
  const manifest = await readJson(path.join(root, 'src/extensions/sidebarAgent/SidebarAgentApplicationCustomizer.manifest.json'));
  const solution = metadata.solution;
  if (solution.skipFeatureDeployment !== false || solution.includeClientSideAssets !== true ||
      solution.features?.length !== 1 ||
      !isDeepStrictEqual(solution.features[0].assets?.elementManifests, ['elements.xml'])) {
    throw new Error('Use a site-installed package with included assets and only elements.xml; tenant-wide activation is not supported.');
  }
  versionParts(solution.version);
  if (solution.features[0].version !== solution.version) throw new Error('Keep solution and feature versions equal.');
  const packagePath = path.resolve(root, 'sharepoint', metadata.paths.zippedPackage);
  if (path.dirname(packagePath) !== path.join(root, 'sharepoint/solution') || !packagePath.endsWith('.sppkg')) {
    throw new Error('The package must be a .sppkg directly inside sharepoint/solution.');
  }
  return {
    root, properties, siteUrl: target, appCatalogUrl: catalog, packagePath,
    version: solution.version, productId: guid(solution.id, 'solution.id'),
    componentId: guid(manifest.id, 'component.id'), featureId: guid(solution.features[0].id, 'feature.id'),
    dryRun: !!values['dry-run'], packageOnly: !!values['package-only'], replace: !!values.replace
  };
}

function versionParts(version) {
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+\.\d+$/.test(version) ||
      version.split('.').some(part => Number(part) > 65535)) throw new Error(`Invalid package version: ${version}`);
  return version.split('.').map(Number);
}

function compareVersions(a, b) {
  const left = versionParts(a), right = versionParts(b);
  for (let index = 0; index < 4; index++) if (left[index] !== right[index]) return Math.sign(left[index] - right[index]);
  return 0;
}

function xmlEscape(value) {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]);
}

function xmlUnescape(value) {
  return value.replace(/&(amp|lt|gt|quot|apos);/g, (_, entity) =>
    ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" })[entity]);
}

function elementsXml(options) {
  return `<?xml version="1.0" encoding="utf-8"?>
<Elements xmlns="http://schemas.microsoft.com/sharepoint/">
  <CustomAction Title="SidebarAgent"
    Location="${LOCATION}" ClientSideComponentId="${options.componentId}"
    ClientSideComponentProperties="${xmlEscape(JSON.stringify(options.properties))}" />
</Elements>
`;
}

function packageFingerprint(buffer) {
  const entries = unzipSync(buffer);
  const hash = createHash('sha256');
  for (const name of Object.keys(entries).sort()) {
    let data = entries[name];
    // SPFx regenerates these packaging-only IDs on every build, even for identical inputs.
    if (name.endsWith('.xml.config.xml')) {
      data = strFromU8(data).replace(/<Id>[0-9a-f-]{36}<\/Id>/gi, '<Id>generated</Id>');
    } else if (name === 'ClientSideAssets.xml') {
      data = strFromU8(data).replace(/ Id="[0-9a-f-]{36}"/i, ' Id="generated"');
    }
    hash.update(name).update('\0').update(data).update('\0');
  }
  return hash.digest('hex');
}

function inspectPackage(buffer, options) {
  const entries = unzipSync(buffer);
  const xml = Object.entries(entries).filter(([name]) => /\.xml$/i.test(name)).map(([, data]) => strFromU8(data)).join('\n');
  if (/<ClientSideComponentInstance\b|SkipFeatureDeployment="true"/i.test(xml)) throw new Error('Package contains tenant-wide activation.');
  const actions = [...xml.matchAll(/<CustomAction\b[^>]*>/g)];
  if (actions.length !== 1) throw new Error('Package must contain exactly one customizer activation.');
  if (/\sName="/.test(actions[0][0])) throw new Error('CustomAction Name is not supported by the SharePoint feature XML schema; use Title.');
  const properties = actions[0][0].match(/ClientSideComponentProperties="([^"]*)"/);
  if (!properties || !isDeepStrictEqual(JSON.parse(xmlUnescape(properties[1])), options.properties) ||
      !actions[0][0].includes(`ClientSideComponentId="${options.componentId}"`)) {
    throw new Error('Packaged customizer properties or component ID do not match the requested configuration.');
  }
  const appManifest = strFromU8(entries['AppManifest.xml'] || new Uint8Array());
  const feature = strFromU8(entries[`feature_${options.featureId}.xml`] || new Uint8Array());
  if (!appManifest.includes(`ProductID="${options.productId}"`) || !appManifest.includes(`Version="${options.version}"`) ||
      !feature.includes(`Id="${options.featureId}"`) || !feature.includes(`Version="${options.version}"`) || !feature.includes('Scope="Web"')) {
    throw new Error('Packaged solution identity/version does not match the source metadata.');
  }
  const manifests = [...xml.matchAll(/ComponentManifest="([^"]*)"/g)].map(match => JSON.parse(xmlUnescape(match[1])));
  if (manifests.length !== 1 || manifests[0].id !== options.componentId ||
      !Object.keys(entries).some(name => /ClientSideAssets\/.*\.js$/i.test(name))) {
    throw new Error('Production client assets are missing from the package.');
  }
  for (const manifest of manifests) {
    if (!isDeepStrictEqual(manifest.loaderConfig?.internalModuleBaseUrls, ['HTTPS://SPCLIENTSIDEASSETLIBRARY/'])) {
      throw new Error('Package must load its included SharePoint assets, not localhost or an external CDN.');
    }
    for (const resource of Object.values(manifest.loaderConfig.scriptResources)) {
      if (resource.type === 'path' && !entries[`ClientSideAssets/${resource.path}`]) throw new Error(`Missing packaged script: ${resource.path}`);
    }
  }
  return { fingerprint: packageFingerprint(buffer), entries: Object.keys(entries).length };
}

function runNode(entry, args, { cwd = ROOT, inherit = false, timeout = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [entry, ...args], {
      cwd, shell: false, windowsHide: true, stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'pipe']
    });
    let stdout = '', stderr = '', timedOut = false, forceKill;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
      forceKill = setTimeout(() => child.kill('SIGKILL'), 5000);
    }, timeout);
    child.stdout?.on('data', data => { stdout += data; });
    child.stderr?.on('data', data => { stderr += data; });
    child.once('error', error => { clearTimeout(timer); clearTimeout(forceKill); reject(error); });
    child.once('close', code => {
      clearTimeout(timer);
      clearTimeout(forceKill);
      if (timedOut) reject(new Error(`${path.basename(entry)} timed out. Check remote state before retrying.`));
      else if (code !== 0) reject(new Error(`${path.basename(entry)} exited ${code}: ${(stderr || stdout).trim().slice(-8000)}`));
      else resolve(stdout);
    });
  });
}

async function cli(args, run = runNode) {
  const entry = path.join(path.dirname(require.resolve('@pnp/cli-microsoft365/package.json')), 'dist/index.js');
  const output = await run(entry, [...args, '--output', 'json']);
  if (!output.trim()) return undefined;
  try { return JSON.parse(output); }
  catch { throw new Error(`CLI returned invalid JSON for ${args.slice(0, 4).join(' ')}.`); }
}

async function buildPackage(options, { run = runNode, log = console.log } = {}) {
  const staging = await fs.mkdtemp(path.join(os.tmpdir(), 'sidepane-deploy-'));
  try {
    for (const name of [
      'src', 'config/config.json', 'config/package-solution.json', 'config/sass.json', 'config/write-manifests.json',
      'sharepoint/assets/elements.xml', 'package.json', 'tsconfig.json', 'gulpfile.js', '.eslintrc.js'
    ]) {
      await fs.cp(path.join(options.root, name), path.join(staging, name), { recursive: true });
    }
    await fs.symlink(path.join(options.root, 'node_modules'), path.join(staging, 'node_modules'),
      process.platform === 'win32' ? 'junction' : 'dir');
    await fs.writeFile(path.join(staging, 'sharepoint/assets/elements.xml'), elementsXml(options), 'utf8');
    const gulp = require.resolve('gulp/bin/gulp.js');
    log('Building an isolated, configured production package...');
    await run(gulp, ['bundle', '--ship'], { cwd: staging, inherit: true, timeout: 600000 });
    await run(gulp, ['package-solution', '--ship'], { cwd: staging, inherit: true, timeout: 180000 });
    const generated = path.join(staging, path.relative(options.root, options.packagePath));
    const buffer = await fs.readFile(generated);
    const inspection = inspectPackage(buffer, options);
    await fs.mkdir(path.dirname(options.packagePath), { recursive: true });
    const pending = `${options.packagePath}.${randomUUID()}.tmp`;
    try {
      await fs.copyFile(generated, pending);
      await fs.rename(pending, options.packagePath);
    } finally { await fs.rm(pending, { force: true }); }
    log(`Verified package: ${options.packagePath}`);
    return inspection;
  } finally {
    // Remove the dependency link first; never recursively walk the shared dependency directory.
    await fs.rm(path.join(staging, 'node_modules'), { force: true });
    await fs.rm(staging, { recursive: true, force: true });
  }
}

function array(value, label) {
  if (!Array.isArray(value)) throw new Error(`Invalid ${label} response; expected an array.`);
  return value;
}

function object(value, label) {
  if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error(`Invalid ${label} response; expected an object.`);
  return value;
}

function matchingActions(actions, options) {
  const matches = array(actions, 'custom actions').filter(action =>
    String(action.ClientSideComponentId).toLowerCase() === options.componentId && action.Location === LOCATION);
  if (matches.length > 1 || matches.some(action => action.Scope !== 3)) {
    throw new Error('Conflicting customizer registrations found. Resolve duplicate/Site-scoped actions explicitly; nothing was removed.');
  }
  return matches;
}

async function poll(read, ready, label, { timeout = 300000, interval = 5000, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  const deadline = Date.now() + timeout;
  do {
    const value = await read();
    if (ready(value)) return value;
    if (Date.now() >= deadline) break;
    await sleep(Math.min(interval, Math.max(0, deadline - Date.now())));
  } while (Date.now() <= deadline);
  throw new Error(`Timed out waiting for ${label}. Inspect remote state before retrying.`);
}

async function deploy(options, { command = cli, build = buildPackage, log = console.log, polling } = {}) {
  log(`Target: ${options.siteUrl}\nCatalog: ${options.appCatalogUrl || '(not needed)'}\nPackage: ${options.productId} v${options.version}`);
  log(`Sidepane app client ID: ${options.properties.appClientId}\nRequired SPA redirect: ${options.siteUrl}`);
  if (options.dryRun) {
    log('Dry run: validate existing deployer -> build isolated package -> upload/deploy -> install/upgrade on this site -> verify one customizer. No actions performed.');
    return { dryRun: true };
  }
  if (options.packageOnly) return build(options, { log });
  let stage = 'preflight';
  const completed = [];
  const catalogArgs = ['--appCatalogUrl', options.appCatalogUrl, '--appCatalogScope', 'tenant'];
  const request = url => command(['request', '--url', url, '--method', 'get', '--accept', 'application/json;odata=nometadata']);
  const getActions = () => command(['spo', 'customaction', 'list', '--webUrl', options.siteUrl, '--scope', 'All']);
  const getApps = async () => array(await command(['spo', 'app', 'list', ...catalogArgs]), 'catalog apps');
  const findApp = apps => {
    const matches = apps.filter(app => String(app.ProductId).toLowerCase() === options.productId);
    if (matches.length > 1) throw new Error('Multiple catalog apps have the solution ProductId.');
    return matches[0];
  };
  const checkApp = (app, allowLegacyDefaults = false) => {
    object(app, 'app metadata');
    guid(app.ID, 'catalog app ID');
    if (String(app.ProductId).toLowerCase() !== options.productId || app.IsClientSideSolution !== true ||
        app.SkipDeploymentFeature !== false || typeof app.ContainsTenantWideExtension !== 'boolean' ||
        typeof app.IsPackageDefaultSkipFeatureDeployment !== 'boolean' ||
        (!allowLegacyDefaults && (app.ContainsTenantWideExtension || app.IsPackageDefaultSkipFeatureDeployment))) {
      throw new Error('Catalog app identity or activation scope conflicts with this site-only deployment.');
    }
    if (app.IsValidAppPackage !== true) throw new Error(`Invalid catalog package: ${app.ErrorMessage || 'SharePoint rejected the package'}`);
    if (typeof app.InstalledVersion !== 'string' || typeof app.Deployed !== 'boolean' || typeof app.CurrentVersionDeployed !== 'boolean') {
      throw new Error('Incomplete app installation/deployment metadata.');
    }
    return app;
  };
  try {
    const status = await command(['status']);
    if (!status || typeof status !== 'object' || !status.connectedAs) {
      throw new Error('CLI is logged out. Run npm exec -- m365 login with your separate deployment app and explicit tenant GUID, then retry.');
    }
    if (String(status.appTenant).toLowerCase() !== options.properties.tenantId) {
      throw new Error('CLI login tenant does not match tenantId. Sign in explicitly to the intended tenant; authentication was not changed.');
    }
    const actualCatalog = await command(['spo', 'tenant', 'appcatalogurl', 'get']);
    if (typeof actualCatalog !== 'string' || siteUrl(actualCatalog, 'Discovered catalog').toLowerCase() !== options.appCatalogUrl.toLowerCase()) {
      throw new Error('The supplied app catalog does not match the authenticated tenant app catalog.');
    }
    const web = object(await request(`${options.siteUrl}/_api/web?$select=Url`), 'target site');
    if (siteUrl(web.Url, 'Resolved site').toLowerCase() !== options.siteUrl.toLowerCase()) throw new Error('The target resolves to a different SharePoint site.');
    const tenantActions = array(await command(['spo', 'tenant', 'applicationcustomizer', 'list']), 'tenant-wide customizers');
    if (tenantActions.some(action => String(action.TenantWideExtensionComponentId).toLowerCase() === options.componentId)) {
      throw new Error('A tenant-wide registration already exists for this component. Resolve it explicitly before site-only deployment.');
    }
    const initialActions = matchingActions(await getActions(), options);
    const existing = findApp(await getApps());
    if (existing) {
      if (compareVersions(options.version, existing.AppCatalogVersion) < 0) throw new Error('Refusing to downgrade the catalog package.');
      if (compareVersions(options.version, existing.AppCatalogVersion) > 0 && !options.replace) {
        throw new Error('A catalog package already exists. Use --replace to authorize its upgrade; other installations can be affected.');
      }
      const replacingOlderPackage = options.replace && compareVersions(options.version, existing.AppCatalogVersion) > 0;
      checkApp(existing, replacingOlderPackage);
      const installed = checkApp(await request(`${options.siteUrl}/_api/web/tenantappcatalog/AvailableApps/GetById('${existing.ID}')`), replacingOlderPackage);
      if (installed.InstalledVersion && compareVersions(installed.InstalledVersion, options.version) > 0) throw new Error('Refusing to downgrade the site app.');
      if (initialActions.length && !installed.InstalledVersion) throw new Error('An orphaned customizer already exists without an installed app. Resolve it explicitly before installation.');
    } else {
      if (initialActions.length) throw new Error('A standalone customizer already exists. Resolve it explicitly before installing another registration.');
      const filename = path.basename(options.packagePath).replace(/'/g, "''");
      const files = object(await request(`${options.appCatalogUrl}/_api/web/GetFolderByServerRelativePath(DecodedUrl='AppCatalog')/Files?$select=Name&$filter=Name eq '${encodeURIComponent(filename)}'`), 'catalog files');
      if (array(files.value, 'catalog files').length) throw new Error('The package filename is already occupied by a different or unprocessed app. Resolve it before deployment.');
    }
    stage = 'package';
    const inspection = await build(options, { log });
    const upload = !existing || compareVersions(options.version, existing.AppCatalogVersion) > 0;
    if (existing && !upload) {
      const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'sidepane-catalog-'));
      try {
        const file = path.join(temporary, 'existing.sppkg');
        await command(['request', '--url', `${options.appCatalogUrl}/_api/web/GetFileById('${existing.ID}')/$value`,
          '--method', 'get', '--accept', 'application/octet-stream', '--filePath', file]);
        if (packageFingerprint(await fs.readFile(file)) !== inspection.fingerprint) {
          throw new Error('Catalog content differs at the same version. Bump solution/feature versions and use --replace; nothing was overwritten.');
        }
      } finally { await fs.rm(temporary, { recursive: true, force: true }); }
      log('Identical catalog package found; reusing it.');
    }
    if (upload) {
      const latest = findApp(await getApps());
      if (latest?.ID !== existing?.ID || latest?.AppCatalogVersion !== existing?.AppCatalogVersion) {
        throw new Error('The catalog changed during packaging. Inspect the current app and retry; nothing was overwritten.');
      }
      stage = 'upload';
      log(`${existing ? 'Replacing' : 'Uploading'} catalog package, then enabling v${options.version} on ${options.siteUrl}.`);
      await command(['spo', 'app', 'add', '--filePath', options.packagePath, ...catalogArgs, ...(existing ? ['--overwrite'] : [])]);
      completed.push('uploaded package');
    }
    const app = await poll(async () => findApp(await getApps()), value => {
      if (!value || value.AppCatalogVersion !== options.version) return false;
      checkApp(value);
      return true;
    }, 'catalog package processing', polling);
    if (upload || !app.Deployed || !app.CurrentVersionDeployed) {
      stage = 'deploy catalog package';
      await command(['spo', 'app', 'deploy', '--id', app.ID, ...catalogArgs]);
      completed.push('deployed catalog package');
    }
    await poll(async () => findApp(await getApps()), value => {
      if (!value) return false;
      checkApp(value);
      return value.Deployed === true && value.CurrentVersionDeployed === true && value.AppCatalogVersion === options.version;
    }, 'catalog deployment', polling);
    const getSiteApp = async () => {
      const state = checkApp(await request(`${options.siteUrl}/_api/web/tenantappcatalog/AvailableApps/GetById('${app.ID}')`));
      if (state.InstalledVersion !== options.version) {
        const instances = array(await command(['spo', 'app', 'instance', 'list', '--siteUrl', options.siteUrl]), 'site app instances');
        for (const instance of instances.filter(value => String(value.ProductId).toLowerCase() === options.productId)) {
          // AppTiles uses AppStatus: 6 = Initialized, 9 = Disabled (not AppInstanceStatus).
          if (instance.AppStatus === 6 || instance.AppStatus === 9 || instance.AppStatus === 0) {
            const instanceId = guid(instance.AppId, 'app instance ID');
            const details = object(await command(['request', '--url',
              `${options.siteUrl}/_api/web/GetAppInstanceById('${instanceId}')/GetErrorDetails()`,
              '--method', 'post', '--accept', 'application/json;odata=nometadata']), 'installation errors');
            const errors = array(details.value, 'installation errors');
            if (errors.length) {
              throw new Error(`SharePoint installation failed: ${errors.map(error => error.ExceptionMessage || error.ErrorDetail).join('\n')}`);
            }
          }
        }
      }
      return state;
    };
    let siteApp = await getSiteApp();
    if (siteApp.InstalledVersion && compareVersions(siteApp.InstalledVersion, options.version) > 0) throw new Error('Refusing to downgrade the site app.');
    if (!siteApp.InstalledVersion || compareVersions(siteApp.InstalledVersion, options.version) < 0) {
      const operation = siteApp.InstalledVersion ? 'upgrade' : 'install';
      stage = `${operation} site app`;
      await command(['spo', 'app', operation, '--id', app.ID, '--siteUrl', options.siteUrl, '--appCatalogScope', 'tenant']);
      completed.push(`${operation} site app`);
    }
    stage = 'verify site installation';
    siteApp = await poll(getSiteApp, value => value.InstalledVersion === options.version, 'site app installation', polling);
    let [action] = await poll(async () => matchingActions(await getActions(), options),
      matches => matches.length === 1, 'feature-created Web customizer', polling);
    stage = 'verify site properties';
    let currentProperties;
    try { currentProperties = JSON.parse(action.ClientSideComponentProperties); }
    catch { throw new Error('The installed customizer has invalid JSON properties. Resolve it before retrying.'); }
    if (!isDeepStrictEqual(currentProperties, options.properties)) {
      await command(['spo', 'customaction', 'set', '--webUrl', options.siteUrl, '--scope', 'Web', '--id', guid(action.Id, 'custom action ID'),
        '--clientSideComponentProperties', JSON.stringify(options.properties)]);
      completed.push('updated site customizer properties');
    }
    [action] = await poll(async () => matchingActions(await getActions(), options), matches => {
      if (matches.length !== 1) return false;
      return isDeepStrictEqual(JSON.parse(matches[0].ClientSideComponentProperties), options.properties);
    }, 'customizer property readback', polling);
    const report = {
      siteUrl: options.siteUrl, appCatalogUrl: options.appCatalogUrl, productId: options.productId,
      catalogAppId: app.ID, version: siteApp.InstalledVersion, customActionId: action.Id,
      componentId: options.componentId, properties: options.properties, verifiedAt: new Date().toISOString(), ...inspection, completed
    };
    await fs.writeFile(path.join(path.dirname(options.packagePath), 'deployment.local.json'), JSON.stringify(report, null, 2), { mode: 0o600 });
    log(`Verified one site-scoped customizer at ${options.siteUrl}. Open a normal page without debug query parameters.`);
    return report;
  } catch (error) {
    throw new Error(`Deployment stopped at "${stage}": ${error.message}\nCompleted remote operations: ${completed.join(', ') || 'none'}. No automatic rollback was attempted.`);
  }
}

if (require.main === module) {
  loadOptions(process.argv.slice(2)).then(options => options.help ? console.log(HELP) : deploy(options))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}

module.exports = {
  loadOptions, elementsXml, inspectPackage, packageFingerprint, runNode, buildPackage, cli,
  deploy, matchingActions, compareVersions, poll, siteUrl
};
