import { PublicClientApplication, InteractionRequiredAuthError, BrowserAuthError, BrowserAuthErrorCodes } from '@azure/msal-browser';

export interface IAuthSettings {
  appClientId: string;
  tenantId: string;
  currentUserLogin?: string;
  redirectUri: string;
  scopes: string[];
}

export class SignInRequiredError extends Error {
  constructor(public readonly cause?: InteractionRequiredAuthError | BrowserAuthError) {
    super(cause?.message || 'Sign in to connect to your agent.');
    this.name = 'SignInRequiredError';
  }
}

const applications = new Map<string, Promise<PublicClientApplication>>();

function getApplication(settings: IAuthSettings): Promise<PublicClientApplication> {
  const key = `${settings.appClientId}|${settings.tenantId}|${settings.redirectUri}`;
  let application = applications.get(key);
  if (!application) {
    const instance = new PublicClientApplication({
      auth: {
        clientId: settings.appClientId,
        authority: `https://login.microsoftonline.com/${settings.tenantId}`,
        redirectUri: settings.redirectUri
      },
      cache: { cacheLocation: 'sessionStorage' }
    });
    application = instance.initialize().then(() => instance).catch(error => {
      applications.delete(key);
      throw error;
    });
    applications.set(key, application);
  }
  return application;
}

export async function acquireToken(settings: IAuthSettings, interactive = false): Promise<string> {
  const instance = await getApplication(settings);
  const accounts = instance.getAllAccounts();
  const account = settings.currentUserLogin
    ? accounts.find(candidate => candidate.username.toLowerCase() === settings.currentUserLogin?.toLowerCase())
    : accounts.length === 1 ? accounts[0] : undefined;
  const request = { scopes: settings.scopes, loginHint: settings.currentUserLogin };
  if (interactive) return (await instance.acquireTokenPopup(request)).accessToken;
  if (!account && !settings.currentUserLogin) throw new SignInRequiredError();
  try {
    if (account) {
      return (await instance.acquireTokenSilent({ ...request, account })).accessToken;
    }
    return (await instance.ssoSilent(request)).accessToken;
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError ||
      (error instanceof BrowserAuthError && error.errorCode === BrowserAuthErrorCodes.monitorWindowTimeout)) {
      console.warn('Copilot silent sign-in requires interaction:', error.errorCode);
      throw new SignInRequiredError(error);
    }
    throw error;
  }
}
