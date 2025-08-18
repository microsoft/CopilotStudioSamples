import {
  type IPropertyPaneConfiguration,
  PropertyPaneTextField
} from '@microsoft/sp-property-pane';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import { createMSALService, acquireTokenSilent } from './utils/msal';
import { initChatWidgetListener, renderChatWidget } from './utils/chat';

export interface IDynamicsLiveChatSsoWebPartProps {
  applicationId: string;
  redirectUri: string;
  tenantId: string;
  copilotStudioScope: string;
  dynamicsAppId: string,
  dynamicsLcwVersion: string,
  dynamicsOrgId: string,
  dynamicsOrgUrl: string
}

export default class DynamicsLiveChatSsoWebPart extends BaseClientSideWebPart<IDynamicsLiveChatSsoWebPartProps> {

  private _accessToken: string | null = null;

  public async render(): Promise<void> {

    // Check if all required properties are set
    if (!this.properties.applicationId || !this.properties.redirectUri || !this.properties.tenantId || !this.properties.copilotStudioScope || !this.properties.dynamicsAppId || !this.properties.dynamicsLcwVersion || !this.properties.dynamicsOrgId || !this.properties.dynamicsOrgUrl) {
      console.error("Missing required properties for Dynamics Live Chat SSO Web Part.");
      this.domElement.innerHTML = `<section><p>Please configure the web part properties.</p></section>`;
      return;
    }

    this.domElement.innerHTML = `<section> </section>`;

    // Initialize the MSAL service and acquire token of the user.
    const msalService = await createMSALService({
      tenantId: this.properties.tenantId,
      applicationId: this.properties.applicationId,
      redirectUri: this.properties.redirectUri
    });

    // Attempt to acquire token silently
    const token = await acquireTokenSilent(msalService, [this.properties.copilotStudioScope]);
    console.log("Access token acquired silently:", token);
    this._accessToken = token;

    // Initialize the chat widget listener for SSO.
    initChatWidgetListener(this._accessToken, this.properties.copilotStudioScope);

    // Render the Omnichannel Chat Widget
    renderChatWidget(
      this.properties.dynamicsAppId,
      this.properties.dynamicsLcwVersion,
      this.properties.dynamicsOrgId,
      this.properties.dynamicsOrgUrl
    );
  }

  protected get isRenderAsync(): boolean {
    return true;
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [
        {
          header: {
            description: "Dynamics Live Chat SSO Configuration"
          },
          groups: [
            {
              groupName: "Copilot Studio SSO Configuration",
              groupFields: [
                PropertyPaneTextField('applicationId', {
                  label: "Application ID"
                }),
                PropertyPaneTextField('redirectUri', {
                  label: "Redirect URI"
                }),
                PropertyPaneTextField('tenantId', {
                  label: "Tenant ID"
                }),
                PropertyPaneTextField('copilotStudioScope', {
                  label: "Copilot Studio Custom Scope",
                })
              ]
            },
            {
              groupName: "Dynamics Live Chat Configuration",
              groupFields: [
                PropertyPaneTextField('dynamicsAppId', {
                  label: "Dynamics App ID"
                }),
                PropertyPaneTextField('dynamicsLcwVersion', {
                  label: "Dynamics LCW Version"
                }),
                PropertyPaneTextField('dynamicsOrgId', {
                  label: "Dynamics Org ID"
                }),
                PropertyPaneTextField('dynamicsOrgUrl', {
                  label: "Dynamics Org URL"
                })
              ]
            }
          ]
        }
      ]
    };
  }
}
