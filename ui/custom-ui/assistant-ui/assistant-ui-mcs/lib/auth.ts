import { PublicClientApplication, Configuration } from '@azure/msal-browser';
import { msalSettings, settings } from './settings';

console.log('Auth configuration being used:', {
    clientId: settings.appClientId || 'Not set',
    tenantId: settings.tenantId || 'Not set',
  });


const msalConfig: Configuration = {
  auth: {
    clientId: settings.appClientId,
    authority: `https://login.microsoftonline.com/${settings.tenantId}`,
    redirectUri: typeof window !== 'undefined' ? window.location.origin : ''
  },
  cache: {
    cacheLocation: 'localStorage', // recommended for modern SPAs
    storeAuthStateInCookie: true
  }
};

const msalInstance = new PublicClientApplication(msalConfig);

export async function acquireToken(): Promise<string> {
  await msalInstance.initialize(); // Required for IndexedDB cache in v4+

  const accounts = msalInstance.getAllAccounts();
  if (accounts.length === 0) {
    // Trigger interactive login if needed
    await msalInstance.loginPopup({ scopes: msalSettings.scopes });
  }

  try {
    const result = await msalInstance.acquireTokenSilent({
      scopes: msalSettings.scopes,
      account: msalInstance.getAllAccounts()[0]
    });
    return result.accessToken;
  } catch {
    // If silent fails, fallback to interactive login
    const result = await msalInstance.loginPopup({ scopes: msalSettings.scopes });
    return result.accessToken;
  }
}