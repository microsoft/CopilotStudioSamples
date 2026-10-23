import { Log } from '@microsoft/sp-core-library';
import { BaseApplicationCustomizer, PlaceholderContent, PlaceholderName, ApplicationCustomizerContext } from '@microsoft/sp-application-base';
import { IconButton, initializeIcons, MessageBar, MessageBarType, ThemeProvider as FluentThemeProvider } from '@fluentui/react';
import { IReadonlyTheme, ThemeChangedEventArgs, ThemeProvider } from '@microsoft/sp-component-base';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as strings from 'SidebarAgentApplicationCustomizerStrings';
import SidePanel from './components/SidePanel/SidePanel';
import styles from './components/SidePanel/SidePanel.module.scss';
import { ISidebarAgentApplicationCustomizerProperties, ISidebarAgentState } from './models/ISidebarAgentProperties';
import { normalizeConfiguration } from './configuration';
import copilotStudioIcon from './assets/copilot-studio.svg';

const LOG_SOURCE = 'SidebarAgentApplicationCustomizer';

export class SidebarAgentComponent extends React.Component<
  { properties: ISidebarAgentApplicationCustomizerProperties; context: ApplicationCustomizerContext },
  ISidebarAgentState
> {
  public constructor(props: { properties: ISidebarAgentApplicationCustomizerProperties; context: ApplicationCustomizerContext }) {
    super(props);
    const user = props.context.pageContext.user;
    this.state = {
      isPanelOpen: false, hasOpened: false, chatKey: 0,
      currentUserLogin: user.email || user.loginName.split('|').pop()
    };
  }

  public render(): React.ReactElement {
    const { properties, context } = this.props;
    const { isPanelOpen, hasOpened, chatKey, currentUserLogin } = this.state;
    const agentTitle = properties.agentTitle || 'Copilot Studio Agent';
    try {
      normalizeConfiguration(properties);
    } catch (error) {
      return <MessageBar messageBarType={MessageBarType.error}>
        {error instanceof Error ? error.message : 'Check the agent configuration.'}
      </MessageBar>;
    }
    return (
      <>
        <div className={styles.launcher} style={properties.headerBackgroundColor ? { backgroundColor: properties.headerBackgroundColor } : undefined}>
          <IconButton
            onRenderIcon={() => <img src={copilotStudioIcon} width={24} height={24} alt="" />}
            ariaLabel={`Open ${agentTitle}`}
            aria-expanded={isPanelOpen}
            aria-haspopup="dialog"
            title={`Open ${agentTitle} (Microsoft Copilot Studio)`}
            onClick={() => this.setState({ isPanelOpen: true, hasOpened: true })}
          />
        </div>
        {hasOpened && (
          <SidePanel
            isOpen={isPanelOpen}
            properties={properties}
            currentUserLogin={currentUserLogin}
            baseUrl={context.pageContext.web.absoluteUrl}
            onDismiss={() => this.setState({ isPanelOpen: false })}
            onNewConversation={() => this.setState(previous => ({ chatKey: previous.chatKey + 1 }))}
            chatKey={chatKey}
          />
        )}
      </>
    );
  }
}

export default class SidebarAgentApplicationCustomizer extends BaseApplicationCustomizer<ISidebarAgentApplicationCustomizerProperties> {
  private _topPlaceholder?: PlaceholderContent;
  private _reactContainer?: HTMLDivElement;
  private _themeProvider?: ThemeProvider;
  private _theme?: IReadonlyTheme;

  public onInit(): Promise<void> {
    initializeIcons();
    this._themeProvider = this.context.serviceScope.consume(ThemeProvider.serviceKey);
    this._theme = this._themeProvider.tryGetTheme();
    this._themeProvider.themeChangedEvent.add(this, this._onThemeChanged);
    Log.info(LOG_SOURCE, `Initialized ${strings.Title}`);
    this.context.placeholderProvider.changedEvent.add(this, this._renderPlaceholders);
    this._renderPlaceholders();
    return Promise.resolve();
  }

  private _renderPlaceholders = (): void => {
    if (this._topPlaceholder) return;
    this._topPlaceholder = this.context.placeholderProvider.tryCreateContent(PlaceholderName.Top, { onDispose: this._unmount });
    if (!this._topPlaceholder) {
      Log.warn(LOG_SOURCE, 'Top placeholder is not available on this page.');
      return;
    }
    this._reactContainer = document.createElement('div');
    this._topPlaceholder.domElement.appendChild(this._reactContainer);
    this._renderComponent();
  };

  private _renderComponent = (): void => {
    if (this._reactContainer) {
      ReactDOM.render(
        <FluentThemeProvider theme={this._theme}>
          <SidebarAgentComponent properties={this.properties} context={this.context} />
        </FluentThemeProvider>,
        this._reactContainer
      );
    }
  };

  private _onThemeChanged = (event: ThemeChangedEventArgs): void => {
    this._theme = event.theme;
    this._renderComponent();
  };

  private _unmount = (): void => {
    if (this._reactContainer) {
      ReactDOM.unmountComponentAtNode(this._reactContainer);
      this._reactContainer.remove();
      this._reactContainer = undefined;
    }
    this._topPlaceholder = undefined;
  };

  public onDispose(): void {
    this.context.placeholderProvider.changedEvent.remove(this, this._renderPlaceholders);
    this._themeProvider?.themeChangedEvent.remove(this, this._onThemeChanged);
    this._topPlaceholder?.dispose();
    this._unmount();
  }
}
