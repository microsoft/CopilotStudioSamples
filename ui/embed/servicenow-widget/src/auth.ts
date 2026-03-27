import { CopilotStudioClient } from '@microsoft/agents-copilotstudio-client'
import type { ConnectionSettings } from '@microsoft/agents-copilotstudio-client'

// MSAL is loaded via CDN — reference as global
declare const msal: {
  PublicClientApplication: new (config: unknown) => MsalInstance
  InteractionRequiredAuthError: new (...args: unknown[]) => Error
}

interface MsalInstance {
  initialize(): Promise<void>
  getAllAccounts(): Promise<Array<{ username: string }>>
  acquireTokenSilent(request: unknown): Promise<{ accessToken: string }>
  ssoSilent(request: unknown): Promise<{ accessToken: string }>
  loginPopup(request: unknown): Promise<{ accessToken: string }>
}

let cachedMsalInstance: MsalInstance | null = null

export async function acquireToken(
  settings: ConnectionSettings,
  redirectUri?: string
): Promise<string> {
  if (!cachedMsalInstance) {
    cachedMsalInstance = new msal.PublicClientApplication({
      auth: {
        clientId: settings.appClientId,
        authority: `https://login.microsoftonline.com/${settings.tenantId}`,
      },
    })
    await cachedMsalInstance.initialize()
  }

  const loginRequest = {
    scopes: [CopilotStudioClient.scopeFromSettings(settings)],
    redirectUri: redirectUri || window.location.origin,
  }

  // 1. Try cached refresh token (no UI, instant)
  try {
    const accounts = await cachedMsalInstance.getAllAccounts()
    if (accounts.length > 0) {
      const response = await cachedMsalInstance.acquireTokenSilent({
        ...loginRequest,
        account: accounts[0],
      })
      return response.accessToken
    }
  } catch (e: unknown) {
    if (!(e instanceof msal.InteractionRequiredAuthError)) {
      throw e
    }
  }

  // 2. Try SSO via hidden iframe (no UI, uses existing Entra ID session)
  try {
    const response = await cachedMsalInstance.ssoSilent(loginRequest)
    return response.accessToken
  } catch {
    // Expected to fail if no active session — fall through to popup
  }

  // 3. Last resort: interactive popup (triggered from user click)
  const response = await cachedMsalInstance.loginPopup(loginRequest)
  return response.accessToken
}
