# Copilot Studio - Salesforce Integration Samples

This folder contains sample code for integrating Microsoft Copilot Studio with Salesforce Einstein Bots, enabling Einstein Bot to use Copilot Studio as its AI backend via the DirectLine API.

## Assets Included

| Asset | Description | File |
|-------|-------------|------|
| **DL_GetConversation** | Apex class that starts a DirectLine conversation with Copilot Studio | [`ApexClasses/DL_GetConversation.cls`](./ApexClasses/DL_GetConversation.cls) |
| **DL_PostActivity** | Apex class that sends user messages to Copilot Studio | [`ApexClasses/DL_PostActivity.cls`](./ApexClasses/DL_PostActivity.cls) |
| **DL_GetActivity** | Apex class that retrieves bot responses (with polling/retry) | [`ApexClasses/DL_GetActivity.cls`](./ApexClasses/DL_GetActivity.cls) |
| **Remote Site Setting** | Allows Salesforce to call directline.botframework.com | [`Metadata/remoteSiteSettings/DirectLine.remoteSite-meta.xml`](./Metadata/remoteSiteSettings/DirectLine.remoteSite-meta.xml) |
| **External Credential** | Stores authentication config with Custom auth protocol | [`Metadata/externalCredentials/Directline.externalCredential-meta.xml`](./Metadata/externalCredentials/Directline.externalCredential-meta.xml) |
| **Named Credential** | Endpoint configuration for DirectLine API | [`Metadata/namedCredentials/Directline.namedCredential-meta.xml`](./Metadata/namedCredentials/Directline.namedCredential-meta.xml) |
| **Deploy Script** | Automated deployment script | [`scripts/deploy.sh`](./scripts/deploy.sh) (Unix) / [`scripts/deploy.ps1`](./scripts/deploy.ps1) (Windows) |

These samples are companion code for the official documentation at: [Microsoft Learn - Copilot Studio with Salesforce](https://learn.microsoft.com/en-us/microsoft-copilot-studio/customer-copilot-salesforce-handoff)

## Prerequisites

- [Salesforce CLI](https://developer.salesforce.com/tools/salesforcecli) installed
- Salesforce org with Einstein Bots enabled
- Microsoft Copilot Studio agent with DirectLine channel configured

## Quick Start

1. Log in to your Salesforce org:
   ```bash
   sf org login web
   ```

2. Run the deployment script:
   ```bash
   # Unix/macOS
   ./scripts/deploy.sh

   # Windows PowerShell
   .\scripts\deploy.ps1
   ```

3. Follow the Microsoft Learn documentation to:
   - Create the Named Credential with your DirectLine secret
   - Configure Einstein Bot dialogs to use the Apex actions

## What Gets Deployed

The deployment script (`deploy.sh` / `deploy.ps1`) performs these steps:

1. **Deploys Apex Classes** - Uploads `DL_GetConversation`, `DL_PostActivity`, and `DL_GetActivity` to your Salesforce org
2. **Deploys Remote Site Setting** - Enables callouts to `https://directline.botframework.com`
3. **Deploys External Credential** - Creates the `Directline` External Credential with Custom auth protocol and Authorization header formula
4. **Deploys Named Credential** - Creates the `Directline` Named Credential pointing to `https://directline.botframework.com`
5. **Grants Apex Permissions** - Adds the three Apex classes to the `sfdc_chatbot_service_permset` permission set so Einstein Bot can invoke them
6. **Grants Credential Access** - Adds the `Directline_Principal` to the Chatbot permission set's External Credential Principal Access

## Manual Configuration Required

After running the deployment script, you must:

1. **Add your DirectLine secret** to the External Credential:
   - Go to Setup → Named Credentials → External Credentials tab
   - Click `Directline` → Under Principals, click `Directline_Principal`
   - Click **Add** under Authentication Parameters
   - Set Name: `Token`, Value: `YOUR_DIRECTLINE_SECRET`
   - Save

2. **Configure Einstein Bot dialogs** to call the Apex actions

See the [Microsoft Learn documentation](https://learn.microsoft.com/en-us/microsoft-copilot-studio/customer-copilot-salesforce-handoff) for detailed instructions.
