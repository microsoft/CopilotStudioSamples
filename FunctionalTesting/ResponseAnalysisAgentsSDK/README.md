# Copilot Studio Response Analysis Tool

## Prerequisite.

To set up this sample, you will need the following:

1. [Python](https://www.python.org/) version 3.9 or higher
2. An Agent Created in Microsoft Copilot Studio or access to an existing Agent.
3. Ability to Create an Application Identity in Azure for a Public Client/Native App Registration Or access to an existing Public Client/Native App registration with the `CopilotStudio.Copilots.Invoke` API Permission assigned. 

## Authentication.

The Copilot Studio Response Analysis Tool requires a User Token to operate. For this sample, we are using a user interactive flow to get the user token for the application ID created above. Other flows are allowed.

> [!Important]
> The token is cached in the user machine in `.local_token_cache.json`

## Create an Agent in Copilot Studio.

1. Create an Agent in [Copilot Studio](https://copilotstudio.microsoft.com)
    1. Publish your newly created Copilot
    2. Goto Settings => Advanced => Metadata and copy the following values, You will need them later:
        1. Schema name
        2. Environment Id

## Create an Application Registration in Entra ID.

This step will require permissions to create application identities in your Azure tenant. For this sample, you will create a Native Client Application Identity, which does not have secrets.

1. Open https://portal.azure.com 
2. Navigate to Entra Id
3. Create a new App Registration in Entra ID 
    1. Provide a Name
    2. Choose "Accounts in this organization directory only"
    3. In the "Select a Platform" list, Choose "Public Client/native (mobile & desktop) 
    4. In the Redirect URI url box, type in `http://localhost` (**note: use HTTP, not HTTPS**)
    5. Then click register.
4. In your newly created application
    1. On the Overview page, Note down for use later when configuring the example application:
        1. The Application (client) ID
        2. The Directory (tenant) ID
    2. Go to API Permissions in `Manage` section
    3. Click Add Permission
        1. In the side panel that appears, Click the tab `API's my organization uses`
        2. Search for `Power Platform API`.
            1. *If you do not see `Power Platform API` see the note at the bottom of this section.*
        3. In the *Delegated permissions* list, choose `CopilotStudio` and Check `CopilotStudio.Copilots.Invoke`
        4. Click `Add Permissions`
    4. (Optional) Click `Grant Admin consent for copilotsdk`

> [!TIP]
> If you do not see `Power Platform API` in the list of API's your organization uses, you need to add the Power Platform API to your tenant. To do that, goto [Power Platform API Authentication](https://learn.microsoft.com/power-platform/admin/programmability-authentication-v2#step-2-configure-api-permissions) and follow the instructions on Step 2 to add the Power Platform Admin API to your Tenant

## Instructions - Configure the Copilot Studio Response Analysis Tool.

With the above information, you can now run the `Copilot Studio Response Analysis Tool` sample.

1. Open the `env.TEMPLATE` file and rename it to `.env`.
2. Configure the values based on what was recorded during the setup phase.

```bash
  COPILOTSTUDIOAGENT__ENVIRONMENTID="" # Environment ID of environment with the CopilotStudio App.
  COPILOTSTUDIOAGENT__SCHEMANAME="" # Schema Name of the Copilot to use
  COPILOTSTUDIOAGENT__TENANTID="" # Tenant ID of the App Registration used to login, this should be in the same tenant as the Copilot.
  COPILOTSTUDIOAGENT__AGENTAPPID="" # App ID of the App Registration used to login, this should be in the same tenant as the CopilotStudio environment.
```

3. Run `pip install -r requirements.txt` to install all dependencies. 

4. List test utterances sequentially in the `/data/input.txt` file. Marke the end of the file with "exit".
    
    <p  align="center">
        <img  src="img/DataSet.png"  alt="input data or utterances."  width="600px">
        <br>
	</p> 

## Instructions - Run the Copilot Studio Response Analysis Tool.

1. Run the Copilot Studio Response Analysis Tool using. This should challenge you to login and connect to the Copilot Studio Hosted agent

```sh
python -m src.main
```
2. The command displays the local URL hosting the ap. 

    <p  align="center">
        <img  src="img/RunningURL.png"  alt="input data or utterances."  width="600px">
        <br>
	</p> 

3. Copy the URL and paste in browser and load application. 

    <p  align="center">
        <img  src="img/URLLoad.png"  alt="input data or utterances."  width="500px" height="35">
        <br>
	</p> 

4. Click `Start Test Run` on the console.

    <p  align="center">
        <img  src="img/StartTestRun.png"  alt="input data or utterances."  width="75px" height="50">
        <br>
	</p> 

> [!Important]
> Cross check test utterances are sequentially listed in the `/data/input.txt` file.

## Instructions - Interpret the Copilot Studio Response Analysis Tool.

1. Click `Start Test Run` on the console.
