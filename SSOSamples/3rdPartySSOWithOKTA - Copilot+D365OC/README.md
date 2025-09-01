
# Unified SSO with Copilot Agent and D365 Omnichannel

This sample app demonstrates unified SSO with Copilot Agent and D365 Omnichannel using a 3rd party authentication provider. 

> *Use Case:* C2 get authenticated to Copilot agent and D365 Omnichannel at the start of the session. C2 can get authenticated / private information from Copilot agent and continue to have secure conversation with live agent on agent handover. 

## Authentication Process

```mermaid
sequenceDiagram
Note left of Chat Widget: 1. Client side Okta <br/>Authentication widget <br/>.
Chat Widget -->> Okta: 2. Send authentication challenge.
Okta-->> Chat Widget: 3. Return access token.
Chat Widget -->> Copilot Studio: 4. Send access token.
Note right of Copilot Studio: 5. [OPTIONAL] Validate token <br/>using retrospection endpoint. <br/>.
Copilot Studio -->> 3rd Party Systems: 6. Access token authenticates users.
Note left of Chat Widget: 7. Sign JWT token <br/>with private key. <br/>.
Chat Widget -->> D365 Omnichannel: 8. Send signed JWT token.
Note right of D365 Omnichannel: 9. Validates JWT token <br/>with public key. <br/>.
D365 Omnichannel -->> Chat Widget: 10. Return auth confirmation.
```

## Detailed instructions

- [Run locally](/SSOSamples/3rdPartySSOWithOKTA - Copilot D365OC/docs/README-RunOnAzure.md)
- [Run on Azure](/SSOSamples/3rdPartySSOWithOKTA - Copilot D365OC/docs/README-RunOnAzure.md)

## Authors

- [Vineet Kaul](vineetkaul@microsoft.com)
- [Jeff Luo](jluo@microsoft.com)

## License

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/)