import { BaseApplicationCustomizer } from '@microsoft/sp-application-base';
/**
 * If your command set uses the ClientSideComponentProperties JSON input,
 * it will be deserialized into the BaseExtension.properties object.
 * You can define an interface to describe it.
 */
/**
 * Properties for the PvaSsoApplicationCustomizer.
 */
export interface IPvaSsoApplicationCustomizerProperties {
    /**
     * The URL of the bot.
     */
    botURL: string;
    /**
     * The name of the bot.
     */
    botName?: string;
    /**
     * The label for the button.
     */
    buttonLabel?: string;
    /**
     * The email of the user.
     */
    userEmail: string;
    /**
     * The URL of the bot's avatar image.
     */
    botAvatarImage?: string;
    /**
     * The initials of the bot's avatar.
     */
    botAvatarInitials?: string;
    /**
     * Whether or not to greet the user.
     */
    greet?: boolean;
    /**
     * The custom scope defined in the Azure AD app registration for the bot.
     */
    customScope: string;
    /**
     * The client ID from the Azure AD app registration for the bot.
     */
    clientID: string;
    /**
     * Azure AD tenant login URL
     */
    authority: string;
}
/** A Custom Action which can be run during execution of a Client Side Application */
export default class PvaSsoApplicationCustomizer extends BaseApplicationCustomizer<IPvaSsoApplicationCustomizerProperties> {
    private _bottomPlaceholder;
    onInit(): Promise<void>;
    private _renderPlaceHolders;
    private _onDispose;
}
//# sourceMappingURL=PvaSsoApplicationCustomizer.d.ts.map