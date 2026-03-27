import { PublicClientApplication, Configuration } from '@azure/msal-browser';

export interface MSALConfig {
    tenantId: string;
    applicationId: string;
    redirectUri: string;
}

export const createMSALService = async (config: MSALConfig): Promise<PublicClientApplication> => {
    const msalConfig: Configuration = {
        auth: {
            authority: `https://login.microsoftonline.com/${config.tenantId}`,
            clientId: config.applicationId,
            redirectUri: config.redirectUri
        },
        cache: {
            cacheLocation: "localStorage",
        }
    };
    const msalClient = new PublicClientApplication(msalConfig);
    await msalClient.initialize();
    return msalClient;
};

export const acquireTokenSilent = async (msalClient: PublicClientApplication, scopes: string[]): Promise<string> => {
    try {
        const accounts = msalClient.getAllAccounts();
        if (accounts.length === 0) {
            throw new Error("No accounts found. User needs to sign in.");
        }
        const response = await msalClient.acquireTokenSilent({
            scopes: scopes,
            account: accounts[0]
        });
        return response.accessToken;
    } catch (error) {
        console.error("Error acquiring token silently:", error);
        throw error;
    }
}