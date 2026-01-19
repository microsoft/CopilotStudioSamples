import { IInputs, IOutputs } from "./generated/ManifestTypes";
import * as React from "react";
import * as ReactDOM from "react-dom";
import Chat, { IChatProps, ChatRef } from "./Chat/Chat";

export class ChatControl
  implements ComponentFramework.StandardControl<IInputs, IOutputs>
{
  private _appDiv: HTMLDivElement;
  private _notifyOutputChanged: () => void;
  private _context: ComponentFramework.Context<IInputs>;
  private _settings: IChatProps;
  private _container: HTMLDivElement;
  private _inputElement: React.ReactElement;
  private _chatRef = React.createRef<ChatRef>();
  private _prevMessage: string | undefined;
  private _agentMessage: string | undefined;
  private _userMessage: string | undefined;
  private _prevAgentMessage: string | undefined;
  private _chatKey = 1;
  private _chatInitialized = false;
  private _conversationId: string | undefined;
  private _eventValue: string | undefined;

  /**
   * Initializes the control instance.
   * @param context The property bag containing values and utility functions
   * @param notifyOutputChanged Callback to alert framework of new outputs
   * @param state Persistent data for the current session
   * @param container The div element to render the control within
   */
  public init(
    context: ComponentFramework.Context<IInputs>,
    notifyOutputChanged: () => void,
    state: ComponentFramework.Dictionary,
    container: HTMLDivElement
  ): void {
    this._context = context;
    this._settings = this._initializeSettings(context);
    this._container = container;
    this._notifyOutputChanged = notifyOutputChanged;

    context.mode.trackContainerResize(true);

    this._appDiv = document.createElement("div");

    const allocatedWidth = context.mode.allocatedWidth;
    const allocatedHeight = context.mode.allocatedHeight;

    this._appDiv.style.width = allocatedWidth + "px";
    this._appDiv.style.height = allocatedHeight + "px";

    container.appendChild(this._appDiv);

    this._inputElement = this._createChatElement();
    ReactDOM.render(this._inputElement, this._appDiv, () => {
      console.log("Chat component rendered successfully");
    });
  }
  private _startNewConversation = (): void => {
    this._chatKey += 1;
    this._conversationId = undefined;
    this._agentMessage = undefined;
    this._prevAgentMessage = undefined;
    this._chatInitialized = false;
    this._prevMessage = undefined;
    this._userMessage = undefined;
    this._eventValue = undefined;
    this._notifyOutputChanged();
    this._recreateChatComponent();
  };

  private _createChatElement(): React.ReactElement {
    const allocatedWidth = this._context.mode.allocatedWidth;
    const allocatedHeight = this._context.mode.allocatedHeight;

    return React.createElement(Chat, {
      key: this._chatKey,
      agentTitle: this._settings.agentTitle,
      appClientId: this._settings.appClientId,
      tenantId: this._settings.tenantId,
      environmentId: this._settings.environmentId,
      agentIdentifier: this._settings.agentIdentifier,
      directConnectUrl: this._settings.directConnectUrl,
      showTyping: true,
      currentUserLogin: this._settings.currentUserLogin,
      baseUrl: this._settings.baseUrl,
      styleOptions: this._settings.styleOptions,
      disableFileUploadButton: this._settings.disableFileUploadButton,
      width: allocatedWidth + "px",
      height: allocatedHeight + "px",
      onAgentMessageUpdate: (message: string) => {
        this._agentMessage = message;
        if (
          this._agentMessage !== null &&
          this._agentMessage !== undefined &&
          this._agentMessage !== this._prevAgentMessage
        ) {
          this._prevAgentMessage = this._agentMessage;
          this._notifyOutputChanged();
        }
      },
      onConversationIdUpdate: (conversationId: string) => {
        console.log("Conversation ID updated:", conversationId);
        this._conversationId = conversationId ?? undefined;
        this._notifyOutputChanged();
        // Send event value if available
        if (
          this._eventValue === undefined &&
          this._context.parameters.eventValue?.raw !== undefined &&
          this._context.parameters.eventValue?.raw !== null &&
          this._context.parameters.eventValue?.raw.length > 0
        ) {
          this._eventValue =
            this._context.parameters.eventValue?.raw ?? undefined;
          if (this._chatRef.current) {
            this._chatRef.current.sendEvent("webchat/join", {
              message: this._eventValue,
            });
          }
        }
        // Send first message if available
        if (
          this._userMessage === undefined ||
          this._userMessage !== this._context.parameters.message?.raw
        ) {
          this._userMessage =
            this._context.parameters.message?.raw ?? undefined;
          if (
            this._userMessage &&
            this._userMessage !== "val" &&
            this._userMessage !== this._prevMessage
          ) {
            this._prevMessage = this._userMessage;
            if (this._chatRef.current) {
              this._chatRef.current.sendMessage(this._userMessage);
            }
          }
        }
      },
      onNewConversation: this._startNewConversation,

      ref: this._chatRef,
    });
  }

  private _recreateChatComponent(): void {
    this._inputElement = this._createChatElement();
    ReactDOM.render(this._inputElement, this._appDiv);
  }

  private _initializeSettings(
    context: ComponentFramework.Context<IInputs>
  ): IChatProps {
    return {
      agentTitle: context.parameters.agentTitle.raw || "Agent",
      appClientId: context.parameters.appClientId.raw || "",
      tenantId: context.parameters.tenantId.raw || "",
      currentUserLogin: context.parameters.username.raw || "",
      baseUrl: window.location.origin + "/",
      environmentId: context.parameters.environmentId.raw || "",
      agentIdentifier: context.parameters.agentIdentifier.raw || "",
      disableFileUploadButton:
        context.parameters.disableFileUpload.raw || false,
      directConnectUrl:
        `https://${this.convertUUID(context.parameters.environmentId.raw || "")}.environment.api.powerplatform.com/copilotstudio/dataverse-backed/authenticated/bots/${context.parameters.agentIdentifier.raw || ""}/conversations?api-version=2022-03-01-preview`,
      styleOptions: context.parameters.styleOptions.raw || "",
      width: context.mode.allocatedWidth,
      height: context.mode.allocatedHeight,
    };
  }

  public updateView(context: ComponentFramework.Context<IInputs>): void {
    this._context = context;

    // Check which properties have changed
    const hasAllocatedWidthChanged =
      this._settings.width !== context.mode.allocatedWidth;
    const hasAllocatedHeightChanged =
      this._settings.height !== context.mode.allocatedHeight;
    const hasAgentTitleChanged =
      this._settings.agentTitle !== context.parameters.agentTitle.raw;
    const hasAppClientIdChanged =
      this._settings.appClientId !== context.parameters.appClientId.raw;
    const hasTenantIdChanged =
      this._settings.tenantId !== context.parameters.tenantId.raw;
    const hasEnvironmentIdChanged =
      this._settings.environmentId !== context.parameters.environmentId.raw;
    const hasAgentIdentifierChanged =
      this._settings.agentIdentifier !== context.parameters.agentIdentifier.raw;
    const hasUsernameChanged =
      this._settings.currentUserLogin !== context.parameters.username.raw;
    const hasDisableFileUploadChanged =
      this._settings.disableFileUploadButton !==
      context.parameters.disableFileUpload.raw;
    const hasStyleOptionsChanged =
      this._settings.styleOptions !== context.parameters.styleOptions.raw;

    const hasAnyPropertyChanged =
      hasAgentTitleChanged ||
      hasAppClientIdChanged ||
      hasTenantIdChanged ||
      hasEnvironmentIdChanged ||
      hasAgentIdentifierChanged ||
      hasUsernameChanged ||
      hasDisableFileUploadChanged ||
      hasStyleOptionsChanged ||
      hasAllocatedWidthChanged ||
      hasAllocatedHeightChanged;
    if (hasAnyPropertyChanged) {
      this._settings = this._initializeSettings(context);
      this._startNewConversation();
      // Update the component to reflect any size changes
      this._inputElement = this._createChatElement();
      ReactDOM.render(this._inputElement, this._appDiv);
      return;
    }

    if (
      this._conversationId !== undefined &&
      (this._userMessage === undefined ||
        this._userMessage !== context.parameters.message?.raw)
    ) {
      this._userMessage = context.parameters.message?.raw ?? undefined;
      if (
        this._userMessage &&
        this._userMessage !== "val" &&
        this._userMessage !== this._prevMessage
      ) {
        this._prevMessage = this._userMessage;
        if (this._chatRef.current) {
          this._chatRef.current.sendMessage(this._userMessage);
        }
        return;
      }
    }
  }
  /**
   * Returns the current outputs of the control.
   * @returns Object containing the agent's response message
   */
  public getOutputs(): IOutputs {
    return {
      response: this._agentMessage,
      conversationId: this._conversationId,
    };
  }

  /**
   * Cleanup method called when the control is removed from the DOM.
   */
  public destroy(): void {
    if (this._container) {
      ReactDOM.unmountComponentAtNode(this._container);
    }
  }

  /**
   * Converts a standard UUID to the format expected by Power Platform environment URLs.
   * @param uuid The UUID to convert
   * @returns Converted UUID with dot notation
   */
  public convertUUID(uuid: string): string {
    const cleaned = uuid.replace(/-/g, "");
    const mainPart = cleaned.slice(0, 30);
    const decimalPart = cleaned.slice(30);
    return `${mainPart}.${decimalPart}`;
  }
}
