/*
*This is auto generated from the ControlManifest.Input.xml file
*/

// Define IInputs and IOutputs Type. They should match with ControlManifest.
export interface IInputs {
    agentTitle: ComponentFramework.PropertyTypes.StringProperty;
    message: ComponentFramework.PropertyTypes.StringProperty;
    eventValue: ComponentFramework.PropertyTypes.StringProperty;
    disableFileUpload: ComponentFramework.PropertyTypes.TwoOptionsProperty;
    styleOptions: ComponentFramework.PropertyTypes.StringProperty;
    appClientId: ComponentFramework.PropertyTypes.StringProperty;
    tenantId: ComponentFramework.PropertyTypes.StringProperty;
    environmentId: ComponentFramework.PropertyTypes.StringProperty;
    agentIdentifier: ComponentFramework.PropertyTypes.StringProperty;
    username: ComponentFramework.PropertyTypes.StringProperty;
}
export interface IOutputs {
    agentTitle?: string;
    message?: string;
    eventValue?: string;
    response?: string;
    conversationId?: string;
    disableFileUpload?: boolean;
    styleOptions?: string;
    appClientId?: string;
    tenantId?: string;
    environmentId?: string;
    agentIdentifier?: string;
    username?: string;
}
