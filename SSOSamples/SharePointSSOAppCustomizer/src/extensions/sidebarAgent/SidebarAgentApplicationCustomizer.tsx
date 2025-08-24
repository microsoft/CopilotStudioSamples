import { Log } from '@microsoft/sp-core-library';
import {
  BaseApplicationCustomizer,
  PlaceholderContent,
  PlaceholderName
} from '@microsoft/sp-application-base';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { 
  PrimaryButton, 
  Panel, 
  PanelType
} from '@fluentui/react';
import * as strings from 'SidebarAgentApplicationCustomizerStrings';
import Chat from './Chat';

const LOG_SOURCE: string = 'SidebarAgentApplicationCustomizer';

export interface ISidebarAgentApplicationCustomizerProperties {
  appClientId: string;
  tenantId: string;
  environmentId: string;
  agentIdentifier: string;
  directConnectUrl?: string;
  showTyping?: boolean;
}

interface ISidebarAgentState {
  isPanelOpen: boolean;
  currentUserLogin?: string;
}

class SidebarAgentComponent extends React.Component<{ properties: ISidebarAgentApplicationCustomizerProperties, context: any }, ISidebarAgentState> {
  constructor(props: { properties: ISidebarAgentApplicationCustomizerProperties, context: any }) {
    super(props);
    this.state = {
      isPanelOpen: false,
      currentUserLogin: undefined
    };
  }

  public componentDidMount(): void {
    // Get the current logged-in user's login name from SharePoint context
    if (this.props.context && this.props.context.pageContext && this.props.context.pageContext.user) {
      this.setState({
        currentUserLogin: this.props.context.pageContext.user.loginName || this.props.context.pageContext.user.email
      });
    }
  }

  private _togglePanel = (): void => {
    this.setState({ isPanelOpen: !this.state.isPanelOpen });
  };

  private _onPanelDismiss = (): void => {
    this.setState({ isPanelOpen: false });
  };

  public render(): React.ReactElement {
    const { isPanelOpen } = this.state;
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '4px 12px', background: '#0fa781' }}>
          <PrimaryButton onClick={this._togglePanel}>
            {isPanelOpen ? 'Close Agent' : 'Open Agent'}
          </PrimaryButton>
        </div>
        <Panel
          isOpen={isPanelOpen}
          type={PanelType.custom}
          customWidth="30vw"
          onDismiss={this._onPanelDismiss}
          headerText={strings.Title}
          closeButtonAriaLabel="Close"
          isLightDismiss={true}
          isBlocking={false}
          styles={{ 
            main: { 
              display: 'flex', 
              flexDirection: 'column', 
              height: '100vh'
            },
            scrollableContent: {
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              overflow: 'hidden'
            },
            content: {
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              padding: 0,
              overflow: 'hidden'
            },
            contentInner: {
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              overflow: 'hidden'
            }
          }}
        >
          <div style={{ 
            flex: 1, 
            minHeight: 0, 
            display: 'flex',
            flexDirection: 'column',
            height: '100%'
          }}>
            <Chat
              appClientId={this.props.properties.appClientId}
              tenantId={this.props.properties.tenantId}
              environmentId={this.props.properties.environmentId}
              agentIdentifier={this.props.properties.agentIdentifier}
              directConnectUrl={this.props.properties.directConnectUrl}
              showTyping={this.props.properties.showTyping}
              currentUserLogin={this.state.currentUserLogin}
            />
          </div>
        </Panel>
      </div>
    );
  }
}

export default class SidebarAgentApplicationCustomizer
  extends BaseApplicationCustomizer<ISidebarAgentApplicationCustomizerProperties> {

  private _topPlaceholder?: PlaceholderContent;
  private _reactContainer?: HTMLDivElement;

  public onInit(): Promise<void> {
    Log.info(LOG_SOURCE, `Initialized ${strings.Title}`);
    this.context.placeholderProvider.changedEvent.add(this, this._renderPlaceholders);
    this._renderPlaceholders();
    return Promise.resolve();
  }

  private _renderPlaceholders(): void {
    if (!this._topPlaceholder) {
      this._topPlaceholder = this.context.placeholderProvider.tryCreateContent(PlaceholderName.Top, { onDispose: this._onDispose });

      if (!this._topPlaceholder) {
        Log.warn(LOG_SOURCE, 'Top placeholder not available.');
        return;
      }

      if (this._topPlaceholder.domElement) {
        this._topPlaceholder.domElement.innerHTML = '';
        this._reactContainer = document.createElement('div');
        this._topPlaceholder.domElement.appendChild(this._reactContainer);

        const componentElement: React.ReactElement = React.createElement(
          SidebarAgentComponent,
          { properties: this.properties, context: this.context }
        );

        ReactDOM.render(componentElement, this._reactContainer);
      }
    }
  }

  private _onDispose = (): void => {
    if (this._reactContainer) {
      try {
        ReactDOM.unmountComponentAtNode(this._reactContainer);
      } catch { /* noop */ }
      this._reactContainer = undefined;
    }
    Log.info(LOG_SOURCE, 'Disposed Top placeholder content.');
  };
}
