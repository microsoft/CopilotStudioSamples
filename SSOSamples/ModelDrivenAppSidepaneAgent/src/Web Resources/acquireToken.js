/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { getUsername } from "./dataverseHelpers.js";

export async function acquireToken (settings) {
  console.log("Acquiring token with settings: ", settings);
  const msalInstance = new window.msal.PublicClientApplication({
    auth: {
      clientId: settings.appClientId,
      authority: `https://login.microsoftonline.com/${settings.tenantId}`,
    },
    cache: {
      cacheLocation: "localStorage",
      storeAuthStateInCookie: true
    }
  })

  // Get username from the Dataverse to provide MSAL with a login hint. 
  // This helps where multiple credentials are available to the browser
  var username = await getUsername();
  console.log("Acquired username: ", username);

  await msalInstance.initialize();
  const loginRequest = {
    scopes: ['https://api.powerplatform.com/.default'],
    redirectUri: window.location.origin,
    loginHint: username
  }

  // When there are not accounts or the acquireTokenSilent/ssoSilent fails,
  // it will fall back to loginPopup.
  var response;

  console.log("Attempting silent SSO");
  try {
    response = await msalInstance.ssoSilent(loginRequest);
    return response.accessToken
  } catch (e) {
    console.log("Silent SSO failed: ", e);  
    if (!(e instanceof window.msal.InteractionRequiredAuthError)) {
      throw e;
    }
  }

  console.log("Falling back to interactive login");
  response =  await msalInstance.loginPopup(loginRequest);
  return response.accessToken;
}
