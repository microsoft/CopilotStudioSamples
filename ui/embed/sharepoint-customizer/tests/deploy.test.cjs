const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { zipSync, strToU8 } = require('fflate');
const {
  loadOptions, elementsXml, inspectPackage, packageFingerprint, runNode,
  buildPackage, cli, deploy, matchingActions, compareVersions, poll
} = require('../scripts/deploy.cjs');
const { validateProperties } = require('../scripts/properties.cjs');

const ROOT = path.resolve(__dirname, '..');
const CLIENT = '11111111-1111-4111-8111-111111111111';
const CATALOG_ID = '44444444-4444-4444-8444-444444444444';
const ACTION_ID = '55555555-5555-4555-8555-555555555555';
const SITE = 'https://contoso.sharepoint.com/sites/team';
const CATALOG = 'https://contoso.sharepoint.com/sites/apps';
const args = [
  '--site-url', SITE, '--app-catalog-url', CATALOG, '--app-client-id', CLIENT,
  '--properties', 'tests/fixtures/deployment.json'
];
const options = extra => loadOptions([...args, ...extra], ROOT);
const quiet = () => {};

async function temporary(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sidepane tests ' & é-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return directory;
}

function packageEntries(config) {
  const manifest = JSON.stringify({
    id: config.componentId,
    loaderConfig: {
      internalModuleBaseUrls: ['HTTPS://SPCLIENTSIDEASSETLIBRARY/'],
      scriptResources: { main: { type: 'path', path: 'main.js' } }
    }
  }).replace(/"/g, '&quot;');
  return {
    'AppManifest.xml': `<App ProductID="${config.productId}" Version="${config.version}" />`,
    [`feature_${config.featureId}.xml`]: `<Feature Id="${config.featureId}" Version="${config.version}" Scope="Web" />`,
    [`${config.featureId}/elements.xml`]: elementsXml(config),
    [`${config.featureId}/Extension.xml`]: `<ClientSideComponent ComponentManifest="${manifest}" />`,
    'ClientSideAssets.xml': `<Feature Id="${randomUUID()}" Scope="Web" />`,
    'ClientSideAssets.xml.config.xml': `<AppPartConfig><Id>${randomUUID()}</Id></AppPartConfig>`,
    'ClientSideAssets/main.js': 'console.log("synthetic fixture");'
  };
}

function archive(entries) {
  return zipSync(Object.fromEntries(Object.entries(entries).map(([name, value]) => [name, strToU8(value)])));
}

function metadata(config, extra = {}) {
  return {
    ID: CATALOG_ID, ProductId: config.productId, AppCatalogVersion: config.version,
    InstalledVersion: '', Deployed: true, CurrentVersionDeployed: true,
    ContainsTenantWideExtension: false, SkipDeploymentFeature: false,
    IsPackageDefaultSkipFeatureDeployment: false, IsValidAppPackage: true,
    IsClientSideSolution: true, ...extra
  };
}

function action(config, extra = {}) {
  return {
    Id: ACTION_ID, ClientSideComponentId: config.componentId,
    Location: 'ClientSideExtension.ApplicationCustomizer', Scope: 3,
    ClientSideComponentProperties: JSON.stringify(config.properties), ...extra
  };
}

async function scenario(t, settings = {}) {
  const config = { ...await options([]), ...settings.options };
  config.packagePath = path.join(await temporary(t), 'sidebar-agent.sppkg');
  const buffer = archive(packageEntries(config));
  const calls = [];
  const state = {
    app: settings.existing ? metadata(config, settings.existing) : undefined,
    installed: settings.installed || '',
    actions: settings.actions || (settings.installed ? [action(config)] : []),
    builds: 0, siteReads: 0
  };
  const command = async commandArgs => {
    calls.push(commandArgs);
    const name = commandArgs.slice(0, commandArgs.indexOf('--output') > -1 ? commandArgs.indexOf('--output') : undefined).join(' ');
    if (settings.fail && name.startsWith(settings.fail)) throw new Error('403 Access denied (fixture)');
    if (name === 'status') return settings.status === undefined ? { connectedAs: 'fixture', appTenant: config.properties.tenantId } : settings.status;
    if (name === 'spo tenant appcatalogurl get') return settings.catalog || CATALOG;
    if (name === 'spo tenant applicationcustomizer list') return settings.tenantActions || [];
    if (name.startsWith('spo customaction list')) return state.actions;
    if (name.startsWith('spo app list')) return state.app ? [state.app] : [];
    if (name.startsWith('request')) {
      const url = commandArgs[commandArgs.indexOf('--url') + 1];
      if (url.endsWith('/_api/web?$select=Url')) return { Url: SITE };
      if (url.includes('/Files?')) return { value: settings.files || [] };
      if (url.includes('/GetFileById(')) {
        await fs.writeFile(commandArgs[commandArgs.indexOf('--filePath') + 1], settings.remotePackage || buffer);
        return undefined;
      }
      if (url.includes('/AvailableApps/GetById(')) {
        state.siteReads++;
        if (state.pendingInstall && state.siteReads >= state.pendingInstall) {
          state.installed = config.version;
          state.actions = [action(config)];
        }
        return metadata(config, { ...state.app, InstalledVersion: state.installed });
      }
    }
    if (name.startsWith('spo app add')) {
      state.app = metadata(config, { Deployed: false, CurrentVersionDeployed: false });
      // The upload response is NOT the product ID and is deliberately ignored.
      return { UniqueId: randomUUID(), Name: 'sidebar-agent.sppkg' };
    }
    if (name.startsWith('spo app deploy')) {
      state.app.Deployed = state.app.CurrentVersionDeployed = true;
      return undefined;
    }
    if (name.startsWith('spo app install') || name.startsWith('spo app upgrade')) {
      state.pendingInstall = state.siteReads + (settings.installDelay || 1);
      return undefined;
    }
    if (name.startsWith('spo customaction set')) {
      state.actions = [action(config, { ClientSideComponentProperties: commandArgs[commandArgs.indexOf('--clientSideComponentProperties') + 1] })];
      return undefined;
    }
    throw new Error(`Unexpected fixture command: ${name}`);
  };
  const build = async () => {
    state.builds++;
    if (settings.buildFailure) throw new Error('Build failed (fixture)');
    await fs.writeFile(config.packagePath, buffer);
    return inspectPackage(buffer, config);
  };
  const run = () => deploy(config, { command, build, log: quiet, polling: { timeout: 200, interval: 0 } });
  const mutations = () => calls.filter(call =>
    ['spo app add', 'spo app deploy', 'spo app install', 'spo app upgrade', 'spo customaction set'].some(prefix => call.join(' ').startsWith(prefix)));
  return { config, state, calls, run, mutations };
}

test('deployment loads supported settings and explicitly overrides the runtime app ID', async () => {
  const config = await options([]);
  assert.equal(config.properties.appClientId, CLIENT);
  assert.equal(config.properties.showReasoning, true);
  assert.equal(config.properties.showToolCalls, false);
  assert.equal(config.siteUrl, SITE);
  assert.equal(config.componentId, '4c6e29f2-7eee-4f9f-bbd2-20c8859d0ba2');
  assert.equal((await loadOptions(['--help'])).help, true);
  assert.equal((await options(['--site-url', `${SITE}/`])).siteUrl, SITE);
});

for (const [name, extra, error] of [
  ['unknown option', ['--secret', 'bad'], /Unknown option/],
  ['runtime client placeholder', ['--app-client-id', 'YOUR_APP_ID'], /GUID/],
  ['HTTP site', ['--site-url', 'http://contoso.sharepoint.com/sites/team'], /HTTPS/],
  ['non-SharePoint site', ['--site-url', 'https://example.com'], /SharePoint/],
  ['URL credentials', ['--site-url', 'https://user:password@contoso.sharepoint.com'], /credentials/],
  ['debug URL', ['--site-url', `${SITE}?loadSPFX=true`], /debug/],
  ['page URL', ['--site-url', `${SITE}/SitePages/Home.aspx`], /page/],
  ['other tenant catalog', ['--app-catalog-url', 'https://other.sharepoint.com/sites/apps'], /same SharePoint host/],
  ['mutually exclusive modes', ['--dry-run', '--package-only'], /not both/]
]) {
  test(`deployment rejects ${name}`, async () => assert.rejects(options(extra), error));
}

test('deployment requires explicit client ID/catalog but offline modes need no catalog', async () => {
  const without = flag => args.filter((_, index) => args[index] !== flag && args[index - 1] !== flag);
  await assert.rejects(loadOptions(without('--app-client-id'), ROOT), /--app-client-id must be a GUID/);
  await assert.rejects(loadOptions(without('--app-catalog-url'), ROOT), /required for live/);
  assert.equal((await loadOptions([...without('--app-catalog-url'), '--package-only'], ROOT)).packageOnly, true);
  assert.equal((await loadOptions([...without('--app-catalog-url'), '--dry-run'], ROOT)).dryRun, true);
});

test('properties validator rejects credentials, bad types, malformed prompts and unsafe URLs', async () => {
  const config = await options([]);
  for (const extra of [
    { clientSecret: 'not-a-real-secret' }, { showReasoning: 'false' }, { agentTitle: 4 },
    { starterPrompts: [{ title: '', text: 'hello' }] }, { directConnectUrl: 'http://example.com' },
    { directConnectUrl: 'https://user:password@example.com' }
  ]) assert.throws(() => validateProperties({ ...config.properties, ...extra }));
});

test('deployment rejects malformed JSON, placeholders, arrays and unknown properties from disk', async t => {
  const file = path.join(await temporary(t), 'settings.json');
  for (const value of ['{', '[]', '{"tenantId":"YOUR_TENANT_ID"}', '{"token":"never"}']) {
    await fs.writeFile(file, value);
    await assert.rejects(options(['--properties', file]));
  }
});

test('XML/package inspection round-trips special characters and rejects bad content', async () => {
  const config = await options([]);
  const entries = packageEntries(config);
  assert.match(elementsXml(config), /&amp;/);
  assert.match(elementsXml(config), /&lt;/);
  assert.match(elementsXml(config), /&apos;/);
  assert.equal(inspectPackage(archive(entries), config).entries, Object.keys(entries).length);
  const rejects = (changes, expected) => assert.throws(() => inspectPackage(archive({ ...entries, ...changes }), config), expected);
  rejects({ 'tenant.xml': '<ClientSideComponentInstance />' }, /tenant-wide/);
  rejects({ 'AppManifest.xml': '<App ProductID="wrong" Version="1.1.0.0"/>' }, /identity/);
  rejects({ [`${config.featureId}/elements.xml`]: elementsXml({ ...config, properties: { ...config.properties, showToolCalls: true } }) }, /properties/);
  rejects({ [`${config.featureId}/Extension.xml`]: entries[`${config.featureId}/Extension.xml`].replace('HTTPS://SPCLIENTSIDEASSETLIBRARY/', 'https://localhost:4321/') }, /localhost/);
  rejects({ [`feature_${config.featureId}.xml`]: entries[`feature_${config.featureId}.xml`].replace('Scope="Web"', 'Scope="Site"') }, /identity/);
  delete entries['ClientSideAssets/main.js'];
  assert.throws(() => inspectPackage(archive(entries), config), /assets/);
});

test('package reuse ignores ZIP timestamps and generated packaging IDs, not code or properties', async () => {
  const config = await options([]);
  const first = archive(packageEntries(config));
  const nextEntries = packageEntries(config);
  assert.equal(packageFingerprint(first), packageFingerprint(archive(nextEntries)));
  nextEntries['ClientSideAssets/main.js'] += '\n// changed';
  assert.notEqual(packageFingerprint(first), packageFingerprint(archive(nextEntries)));
  const changed = packageEntries({ ...config, properties: { ...config.properties, showReasoning: false } });
  assert.notEqual(packageFingerprint(first), packageFingerprint(archive(changed)));
});

test('version comparison is numeric and refuses malformed/out-of-range versions', () => {
  assert.equal(compareVersions('1.10.0.0', '1.9.0.0'), 1);
  assert.equal(compareVersions('1.0.0.0', '1.0.0.0'), 0);
  assert.equal(compareVersions('1.0.0.0', '2.0.0.0'), -1);
  assert.throws(() => compareVersions('1.0', '1.0.0.0'), /Invalid/);
  assert.throws(() => compareVersions('65536.0.0.0', '1.0.0.0'), /Invalid/);
});

test('Node subprocess arguments preserve quotes, Unicode and shell metacharacters literally', async t => {
  const directory = await temporary(t);
  const file = path.join(directory, "runner ' & é.cjs");
  await fs.writeFile(file, 'console.log(JSON.stringify(process.argv.slice(2)));');
  const inputs = ['spaces here', '"quotes"', 'é', '$HOME', '$(echo injected)', '& echo injected', '{"title":"A & B"}'];
  assert.deepEqual(JSON.parse(await runNode(file, inputs, { cwd: directory })), inputs);
  await assert.rejects(runNode(file, [], { cwd: path.join(directory, 'missing') }));
  await fs.writeFile(file, 'console.error("intentional failure"); process.exit(2);');
  await assert.rejects(runNode(file, []), /exited 2.*intentional failure/);
  await fs.writeFile(file, 'setTimeout(() => {}, 10000);');
  await assert.rejects(runNode(file, [], { timeout: 50 }), /timed out/);
});

test('CLI wrapper uses the local JS entry, JSON output, and fails on invalid JSON', async () => {
  const value = await cli(['status'], async (entry, commandArgs) => {
    assert.match(entry.replace(/\\/g, '/'), /@pnp\/cli-microsoft365\/dist\/index\.js$/);
    assert.deepEqual(commandArgs, ['status', '--output', 'json']);
    return '"Logged out"';
  });
  assert.equal(value, 'Logged out');
  assert.equal(await cli(['spo', 'app', 'deploy'], async () => ''), undefined);
  await assert.rejects(cli(['status'], async () => 'not JSON'), /invalid JSON/);
  await assert.rejects(cli(['status'], async () => { throw new Error('denied'); }), /denied/);
});

for (const fail of [false, true]) {
  test(`isolated staging preserves source and dependencies and cleans up on ${fail ? 'failure' : 'success'}`, async t => {
    const root = await temporary(t);
    const config = { ...await options([]), root, packagePath: path.join(root, 'sharepoint/solution/sidebar-agent.sppkg') };
    for (const name of ['src', 'config', 'sharepoint/assets', 'node_modules']) await fs.mkdir(path.join(root, name), { recursive: true });
    for (const name of [
      'package.json', 'tsconfig.json', 'gulpfile.js', '.eslintrc.js', 'sharepoint/assets/elements.xml', 'node_modules/keep.txt',
      'config/config.json', 'config/package-solution.json', 'config/sass.json', 'config/write-manifests.json', 'config/deploy-azure-storage.json'
    ]) {
      await fs.writeFile(path.join(root, name), 'original');
    }
    await fs.writeFile(path.join(root, 'private.local.json'), 'must not be staged');
    let staging;
    const run = async (entry, commandArgs, settings) => {
      staging = settings.cwd;
      assert.notEqual(staging, root);
      assert.equal(await fs.readFile(path.join(staging, 'sharepoint/assets/elements.xml'), 'utf8'), elementsXml(config));
      await assert.rejects(fs.access(path.join(staging, 'private.local.json')), { code: 'ENOENT' });
      await assert.rejects(fs.access(path.join(staging, 'config/deploy-azure-storage.json')), { code: 'ENOENT' });
      assert.equal(await fs.readFile(path.join(staging, 'node_modules/keep.txt'), 'utf8'), 'original');
      assert.ok(['bundle', 'package-solution'].includes(commandArgs[0]));
      assert.equal(commandArgs[1], '--ship');
      if (fail) throw new Error('intentional build failure');
      if (commandArgs[0] === 'package-solution') {
        await fs.mkdir(path.join(staging, 'sharepoint/solution'), { recursive: true });
        await fs.writeFile(path.join(staging, 'sharepoint/solution/sidebar-agent.sppkg'), archive(packageEntries(config)));
      }
    };
    if (fail) await assert.rejects(buildPackage(config, { run, log: quiet }), /intentional/);
    else await buildPackage(config, { run, log: quiet });
    await assert.rejects(fs.access(staging), { code: 'ENOENT' });
    assert.equal(await fs.readFile(path.join(root, 'sharepoint/assets/elements.xml'), 'utf8'), 'original');
    assert.equal(await fs.readFile(path.join(root, 'node_modules/keep.txt'), 'utf8'), 'original');
    if (fail) await assert.rejects(fs.access(config.packagePath), { code: 'ENOENT' });
    else inspectPackage(await fs.readFile(config.packagePath), config);
  });
}

test('dry run does not build or call CLI; package-only does not call CLI', async t => {
  const dry = await scenario(t, { options: { dryRun: true } });
  await dry.run();
  assert.equal(dry.state.builds, 0);
  assert.deepEqual(dry.calls, []);
  const offline = await scenario(t, { options: { packageOnly: true } });
  await offline.run();
  assert.equal(offline.state.builds, 1);
  assert.deepEqual(offline.calls, []);
});

test('first install uses the catalog ID, feature activation and verified asynchronous readback', async t => {
  const fixture = await scenario(t, { installDelay: 3 });
  const report = await fixture.run();
  assert.equal(report.customActionId, ACTION_ID);
  assert.equal(report.catalogAppId, CATALOG_ID);
  assert.equal(report.version, fixture.config.version);
  assert.deepEqual(report.properties, fixture.config.properties);
  assert.deepEqual(fixture.mutations().map(call => call.slice(0, 3).join(' ')), ['spo app add', 'spo app deploy', 'spo app install']);
  assert.ok(fixture.state.siteReads >= 4);
  for (const call of fixture.mutations()) {
    assert.ok(!call.includes('--skipFeatureDeployment'));
    assert.ok(!call.includes('--overwrite'));
    if (call.includes('--id')) assert.equal(call[call.indexOf('--id') + 1], CATALOG_ID);
  }
  const persisted = JSON.parse(await fs.readFile(path.join(path.dirname(fixture.config.packagePath), 'deployment.local.json'), 'utf8'));
  assert.deepEqual(persisted, report);
});

test('identical rerun does not upload, install or duplicate the customizer', async t => {
  const fixture = await scenario(t, { existing: {}, installed: '1.1.0.0' });
  await fixture.run();
  assert.deepEqual(fixture.mutations(), []);
});

test('rerun updates only drifted site properties using one literal JSON argument', async t => {
  const config = await options([]);
  const fixture = await scenario(t, {
    existing: {}, installed: '1.1.0.0',
    actions: [action(config, { ClientSideComponentProperties: '{"old":"settings"}' })]
  });
  await fixture.run();
  const writes = fixture.mutations();
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0].slice(0, 3), ['spo', 'customaction', 'set']);
  assert.deepEqual(JSON.parse(writes[0].at(-1)), config.properties);
});

test('explicit newer-version replacement uploads, deploys and upgrades only the target', async t => {
  const fixture = await scenario(t, { existing: { AppCatalogVersion: '1.0.0.0' }, installed: '1.0.0.0', options: { replace: true } });
  await fixture.run();
  const writes = fixture.mutations();
  assert.deepEqual(writes.map(call => call.slice(0, 3).join(' ')), ['spo app add', 'spo app deploy', 'spo app upgrade']);
  assert.ok(writes[0].includes('--overwrite'));
  assert.equal(writes[2][writes[2].indexOf('--siteUrl') + 1], SITE);
});

test('explicit upgrade accepts an older unused tenant-capable package, not active tenant deployment', async t => {
  const existing = {
    AppCatalogVersion: '1.0.0.0', ContainsTenantWideExtension: true, IsPackageDefaultSkipFeatureDeployment: true
  };
  const fixture = await scenario(t, { existing, options: { replace: true } });
  await fixture.run();
  assert.deepEqual(fixture.mutations().map(call => call.slice(0, 3).join(' ')), ['spo app add', 'spo app deploy', 'spo app install']);
  const active = await scenario(t, { existing: { ...existing, SkipDeploymentFeature: true }, options: { replace: true } });
  await assert.rejects(active.run(), /activation scope/);
  assert.deepEqual(active.mutations(), []);
  const unapproved = await scenario(t, { existing });
  await assert.rejects(unapproved.run(), /--replace/);
  assert.deepEqual(unapproved.mutations(), []);
});

for (const [name, settings, error] of [
  ['logged out', { status: 'Logged out' }, /logged out/],
  ['wrong tenant', { status: { connectedAs: 'fixture', appTenant: 'wrong' } }, /tenant/],
  ['wrong catalog', { catalog: 'https://contoso.sharepoint.com/sites/wrong' }, /does not match/],
  ['permission denial', { fail: 'spo app list' }, /403/],
  ['filename collision', { files: [{ Name: 'sidebar-agent.sppkg' }] }, /filename/],
  ['unapproved replacement', { existing: { AppCatalogVersion: '1.0.0.0' } }, /--replace/],
  ['downgrade', { existing: { AppCatalogVersion: '9.0.0.0' }, options: { replace: true } }, /downgrade/],
  ['tenant-wide package', { existing: { SkipDeploymentFeature: true } }, /activation scope/],
  ['invalid package', { existing: { IsValidAppPackage: false, ErrorMessage: 'invalid XML' } }, /invalid XML/],
  ['incomplete metadata', { existing: { InstalledVersion: undefined } }, /Incomplete/],
  ['build failure', { buildFailure: true }, /Build failed/]
]) {
  test(`deployment stops without remote writes on ${name}`, async t => {
    const fixture = await scenario(t, settings);
    await assert.rejects(fixture.run(), error);
    assert.deepEqual(fixture.mutations(), []);
  });
}

test('different content at the same version cannot be overwritten even with --replace', async t => {
  const config = await options([]);
  const entries = packageEntries(config);
  entries['ClientSideAssets/main.js'] = 'different code';
  const fixture = await scenario(t, { existing: {}, installed: '1.1.0.0', remotePackage: archive(entries), options: { replace: true } });
  await assert.rejects(fixture.run(), /same version/);
  assert.deepEqual(fixture.mutations(), []);
});

test('duplicate, Site-scoped and tenant-wide registrations are never silently removed', async t => {
  const config = await options([]);
  assert.throws(() => matchingActions([action(config), action(config)], config), /Conflicting/);
  assert.throws(() => matchingActions([action(config, { Scope: 2 })], config), /Conflicting/);
  const fixture = await scenario(t, { tenantActions: [{ TenantWideExtensionComponentId: config.componentId }] });
  await assert.rejects(fixture.run(), /tenant-wide registration/);
  assert.deepEqual(fixture.mutations(), []);
});

test('standalone and orphaned actions stop installation before creating a duplicate', async t => {
  const config = await options([]);
  for (const existing of [undefined, {}]) {
    const fixture = await scenario(t, { existing, actions: [action(config)] });
    await assert.rejects(fixture.run(), /standalone|orphaned/);
    assert.deepEqual(fixture.mutations(), []);
  }
});

test('failed install reports earlier mutations and does not write customizer properties', async t => {
  const fixture = await scenario(t, { fail: 'spo app install' });
  await assert.rejects(fixture.run(), /stopped at "install site app".*403[\s\S]*uploaded package, deployed catalog package/);
  assert.ok(!fixture.calls.some(call => call.join(' ').startsWith('spo customaction set')));
  await assert.rejects(fs.access(path.join(path.dirname(fixture.config.packagePath), 'deployment.local.json')), { code: 'ENOENT' });
});

test('polling is bounded and does not swallow access/response errors', async () => {
  await assert.rejects(poll(async () => false, Boolean, 'fixture', { timeout: 0, interval: 0 }), /Timed out.*fixture/);
  await assert.rejects(poll(async () => { throw new Error('403'); }, Boolean, 'fixture'), /403/);
  let reads = 0;
  assert.equal(await poll(async () => ++reads, value => value === 3, 'fixture', { interval: 0 }), 3);
});
