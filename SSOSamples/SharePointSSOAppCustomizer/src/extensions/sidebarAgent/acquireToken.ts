import { PublicClientApplication, InteractionRequiredAuthError } from '@azure/msal-browser';

export interface IAuthSettings {
  appClientId: string;
  tenantId: string;
}

export async function acquireToken (settings: IAuthSettings): Promise<string | undefined> {
  if (!settings?.appClientId || !settings?.tenantId) {
    // Missing settings, cannot authenticate
    return undefined;
  }

  const msalInstance = new PublicClientApplication({
    auth: {
      clientId: settings.appClientId,
      authority: `https://login.microsoftonline.com/${settings.tenantId}`
    }
  });

  await msalInstance.initialize();
  const loginRequest = {
    scopes: ['https://api.powerplatform.com/.default'],
    redirectUri: window.location.origin
  };

  try {
    const accounts = await msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      const response = await msalInstance.acquireTokenSilent({
        ...loginRequest,
        account: accounts[0]
      });
      return response.accessToken;
    }
  } catch (e) {
    if (!(e instanceof InteractionRequiredAuthError)) {
      // Unexpected error
      // eslint-disable-next-line no-console
      console.error('Token acquisition error', e);
      throw e;
    }
  }

  // Fall back to interactive
  const response = await msalInstance.loginPopup(loginRequest);
  return response.accessToken;
}
