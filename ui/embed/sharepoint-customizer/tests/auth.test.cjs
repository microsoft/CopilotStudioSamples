const { test } = require('node:test');
const assert = require('node:assert/strict');
const msal = require('@azure/msal-browser');
const {
  InteractionRequiredAuthError, BrowserAuthError, BrowserAuthErrorCodes, ServerError
} = msal;
const { acquireToken, SignInRequiredError } = require('../temp/tests/components/Chat/acquireToken');

let application = 0;

function fixture(t, handlers = {}, accounts = []) {
  const calls = [];
  const settings = {
    appClientId: `00000000-0000-4000-8000-${String(++application).padStart(12, '0')}`,
    tenantId: '00000000-0000-4000-8000-000000000000',
    currentUserLogin: 'user@example.com',
    redirectUri: 'https://example.com/sites/review',
    scopes: ['https://api.powerplatform.com/CopilotStudio.Copilots.Invoke']
  };
  t.mock.method(console, 'warn', () => {});
  const instance = { getAllAccounts: () => accounts };
  for (const method of ['initialize', 'acquireTokenSilent', 'ssoSilent', 'acquireTokenPopup']) {
    instance[method] = async request => {
      calls.push({ method, request });
      if (handlers[method]) return handlers[method](request);
      if (method === 'initialize') return;
      throw new Error(`Unexpected ${method}`);
    };
  }
  t.mock.method(msal, 'PublicClientApplication', function () { return instance; });
  return { settings, calls, methods: () => calls.map(call => call.method) };
}

const timeout = () => new BrowserAuthError(BrowserAuthErrorCodes.monitorWindowTimeout);
const interaction = () => new InteractionRequiredAuthError('interaction_required');

test('cached token uses the matching SharePoint user and requested SDK scope', async t => {
  const account = { username: 'USER@example.com' };
  const f = fixture(t, { acquireTokenSilent: () => ({ accessToken: 'cached-token' }) }, [
    { username: 'someone-else@example.com' }, account
  ]);
  assert.equal(await acquireToken(f.settings), 'cached-token');
  assert.deepEqual(f.methods(), ['initialize', 'acquireTokenSilent']);
  assert.equal(f.calls[1].request.account, account);
  assert.deepEqual(f.calls[1].request.scopes, f.settings.scopes);
});

test('uncached user can still sign in silently with the SharePoint login hint', async t => {
  const f = fixture(t, { ssoSilent: () => ({ accessToken: 'sso-token' }) });
  assert.equal(await acquireToken(f.settings), 'sso-token');
  assert.deepEqual(f.methods(), ['initialize', 'ssoSilent']);
  assert.equal(f.calls[1].request.loginHint, f.settings.currentUserLogin);
});

for (const failure of [timeout, interaction]) {
  for (const cached of [false, true]) {
    test(`${failure().errorCode} offers sign-in without another iframe or automatic popup (cached=${cached})`, async t => {
      const method = cached ? 'acquireTokenSilent' : 'ssoSilent';
      const f = fixture(t, { [method]: () => { throw failure(); } },
        cached ? [{ username: 'user@example.com' }] : []);
      await assert.rejects(acquireToken(f.settings), SignInRequiredError);
      assert.deepEqual(f.methods(), ['initialize', method]);
    });
  }
}

test('explicit sign-in goes directly to the popup after an iframe timeout', async t => {
  const f = fixture(t, {
    ssoSilent: () => { throw timeout(); },
    acquireTokenPopup: () => ({ accessToken: 'interactive-token' })
  });
  await assert.rejects(acquireToken(f.settings), SignInRequiredError);
  assert.equal(await acquireToken(f.settings, true), 'interactive-token');
  assert.deepEqual(f.methods(), ['initialize', 'ssoSilent', 'acquireTokenPopup']);
  assert.deepEqual(f.calls[2].request, {
    scopes: f.settings.scopes, loginHint: f.settings.currentUserLogin
  });
});

test('popup cancellation is surfaced and an explicit retry does not repeat silent sign-in', async t => {
  const failure = new BrowserAuthError(BrowserAuthErrorCodes.userCancelled);
  let cancelled = true;
  const f = fixture(t, {
    acquireTokenPopup: () => {
      if (cancelled) throw failure;
      return { accessToken: 'retry-token' };
    }
  });
  await assert.rejects(acquireToken(f.settings, true), error => error === failure);
  cancelled = false;
  assert.equal(await acquireToken(f.settings, true), 'retry-token');
  assert.deepEqual(f.methods(), ['initialize', 'acquireTokenPopup', 'acquireTokenPopup']);
});

test('unexpected silent errors are preserved instead of disguised as sign-in requests', async t => {
  const failure = new Error('Authority configuration is invalid');
  const f = fixture(t, { ssoSilent: () => { throw failure; } });
  await assert.rejects(acquireToken(f.settings), error => error === failure);
  assert.deepEqual(f.methods(), ['initialize', 'ssoSilent']);
});

test('Entra server errors retain their full AADSTS message', async t => {
  const failure = new ServerError('invalid_request',
    'AADSTS50011: The redirect URI https://example.com/sites/review does not match the configured redirect URIs.');
  const f = fixture(t, { ssoSilent: () => { throw failure; } });
  await assert.rejects(acquireToken(f.settings), error => error === failure && error.message.includes('AADSTS50011'));
});

test('interaction-required failures retain the original Entra details when offering sign-in', async t => {
  const failure = new InteractionRequiredAuthError('consent_required',
    'AADSTS65001: The user or administrator has not consented to use the application.');
  const f = fixture(t, { ssoSilent: () => { throw failure; } });
  await assert.rejects(acquireToken(f.settings), error =>
    error instanceof SignInRequiredError && error.cause === failure && error.message === failure.message);
});

test('an unrelated cached account is not used for the current SharePoint user', async t => {
  const f = fixture(t, { ssoSilent: () => ({ accessToken: 'current-user-token' }) }, [
    { username: 'someone-else@example.com' }
  ]);
  assert.equal(await acquireToken(f.settings), 'current-user-token');
  assert.deepEqual(f.methods(), ['initialize', 'ssoSilent']);
});

test('no account or login hint offers sign-in without an invalid silent SSO request', async t => {
  const f = fixture(t);
  delete f.settings.currentUserLogin;
  await assert.rejects(acquireToken(f.settings), SignInRequiredError);
  assert.deepEqual(f.methods(), ['initialize']);
});

test('failed MSAL initialization can be retried', async t => {
  const failure = new Error('Initialization unavailable');
  let failed = true;
  const f = fixture(t, {
    initialize: () => { if (failed) throw failure; },
    ssoSilent: () => ({ accessToken: 'retry-token' })
  });
  await assert.rejects(acquireToken(f.settings), error => error === failure);
  failed = false;
  assert.equal(await acquireToken(f.settings), 'retry-token');
  assert.deepEqual(f.methods(), ['initialize', 'initialize', 'ssoSilent']);
});
