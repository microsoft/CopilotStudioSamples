 # SharePoint SSO Component

This code sample demonstrates how to create a SharePoint SPFx component which is a wrapper for a copilot, created with Microsoft Copilot Studio. The SPFx component included in the sample supports SSO, providing seamless authentication for users interacting with the copilot.

## Getting Started

1. Create an app registration in Azure and configure authentication settings for your copilot in Copilot Studio
2. Create an app registration for your SharePoint site
3. Clone this repo and cd into the SharePointSSOComponent folder
4. Install the dependencies and build the component:

    ```shell
    npm install
    gulp bundle --ship
    gulp package-solution --ship
    ```


4. Upload the component to your tenant app catalog and enable on your site

For more detailed instructions, please refer to the [step-by-step setup guide](./SETUP.md).

## The Deployed Component

![Microsoft Copilot Studio SSO](./images/SharePointSSOComponent.png)

