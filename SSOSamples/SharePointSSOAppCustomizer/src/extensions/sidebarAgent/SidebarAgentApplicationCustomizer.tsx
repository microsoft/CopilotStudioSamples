import { Log } from '@microsoft/sp-core-library';
import {
  BaseApplicationCustomizer,
  PlaceholderContent,
  PlaceholderName
} from '@microsoft/sp-application-base';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as strings from 'SidebarAgentApplicationCustomizerStrings';
import SidePanel from './components/SidePanel/SidePanel';
import { 
  ISidebarAgentApplicationCustomizerProperties, 
  ISidebarAgentState 
} from './models/ISidebarAgentProperties';

const LOG_SOURCE: string = 'SidebarAgentApplicationCustomizer';

class SidebarAgentComponent extends React.Component<
  { properties: ISidebarAgentApplicationCustomizerProperties; context: any }, 
  ISidebarAgentState
> {
  constructor(props: { properties: ISidebarAgentApplicationCustomizerProperties; context: any }) {
    super(props);
    this.state = {
      isPanelOpen: false,
      currentUserLogin: undefined,
      chatKey: 0
    };
  }

  public componentDidMount(): void {
    const user = this.props.context?.pageContext?.user;
    if (user) {
      this.setState({
        currentUserLogin: user.loginName || user.email
      });
    }
  }

  private _togglePanel = (): void => {
    this.setState({ isPanelOpen: !this.state.isPanelOpen });
  };

  private _onPanelDismiss = (): void => {
    this.setState({ isPanelOpen: false });
  };

  private _startNewConversation = (): void => {
    this.setState(prevState => ({
      chatKey: prevState.chatKey + 1
    }));
  };

  public render(): React.ReactElement {
    const { isPanelOpen } = this.state;
    const { properties } = this.props;
    
    const headerColor = properties.headerBackgroundColor || 'white';
    const agentTitle = properties.agentTitle || 'Copilot Studio Agent';
    
    const hasRequiredProps = properties.appClientId && 
                           properties.tenantId && 
                           (properties.directConnectUrl || 
                            (properties.agentIdentifier && properties.environmentId));
    
    if (!hasRequiredProps) {
      return (
        <div style={{ padding: '10px', background: '#f3f2f1', color: '#d83b01' }}>
          <strong>Configuration Error:</strong> Missing required properties. Please configure appClientId, tenantId, and either directConnectUrl OR both agentIdentifier and environmentId.
        </div>
      );
    }
    
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '4px 12px', background: headerColor }}>
          <button
            onClick={this._togglePanel}
            aria-label={isPanelOpen ? `Close ${agentTitle}` : `Open ${agentTitle}`}
            style={{
              background: 'transparent',
              border: 'none',
              borderRadius: '8px',
              width: '40px',
              height: '40px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              padding: '6px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <CopilotIcon />
          </button>
        </div>
        
        <SidePanel
          isOpen={isPanelOpen}
          properties={properties}
          currentUserLogin={this.state.currentUserLogin}
          onDismiss={this._onPanelDismiss}
          onNewConversation={this._startNewConversation}
          chatKey={this.state.chatKey}
        />
      </div>
    );
  }
}

const CopilotIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 96 96" fill="none">
    <defs>
      <filter id="filter0_f_84_430" x="-25%" y="-25%" width="200%" height="200%" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feFlood floodOpacity="0" result="BackgroundImageFix"/>
        <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
        <feGaussianBlur stdDeviation="0.4" result="effect1_foregroundBlur_84_430"/>
      </filter>
      <filter id="filter1_f_84_430" x="-25%" y="-25%" width="200%" height="200%" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feFlood floodOpacity="0" result="BackgroundImageFix"/>
        <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
        <feGaussianBlur stdDeviation="4" result="effect1_foregroundBlur_84_430"/>
      </filter>
      <filter id="filter2_f_84_430" x="-25%" y="-25%" width="200%" height="200%" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feFlood floodOpacity="0" result="BackgroundImageFix"/>
        <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
        <feGaussianBlur stdDeviation="0.4" result="effect1_foregroundBlur_84_430"/>
      </filter>
      <filter id="filter3_f_84_430" x="-25%" y="-25%" width="200%" height="200%" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feFlood floodOpacity="0" result="BackgroundImageFix"/>
        <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
        <feGaussianBlur stdDeviation="4" result="effect1_foregroundBlur_84_430"/>
      </filter>
      <linearGradient id="paint0_linear_84_430" x1="26.0005" y1="95.9105" x2="133.153" y2="42.2589" gradientUnits="userSpaceOnUse">
        <stop stopColor="#003580"/>
        <stop offset="0.299454" stopColor="#0057AD"/>
        <stop offset="1" stopColor="#16BFDF"/>
      </linearGradient>
      <linearGradient id="paint1_linear_84_430" x1="2.44788e-07" y1="69.6" x2="32" y2="69.6" gradientUnits="userSpaceOnUse">
        <stop stopColor="#0E637A"/>
        <stop offset="1" stopColor="#0074BD"/>
      </linearGradient>
      <linearGradient id="paint2_linear_84_430" x1="56.5714" y1="71.9787" x2="1.62542" y2="44.3722" gradientUnits="userSpaceOnUse">
        <stop stopColor="#0986B3"/>
        <stop offset="0.721629" stopColor="#16BFDF"/>
        <stop offset="1" stopColor="#3DD9EB"/>
      </linearGradient>
      <linearGradient id="paint3_linear_84_430" x1="9.17938e-07" y1="55" x2="7.28571" y2="55" gradientUnits="userSpaceOnUse">
        <stop stopColor="#0BA0C5"/>
        <stop offset="0.499692" stopColor="#0BA0C5" stopOpacity="0.263415"/>
        <stop offset="1" stopColor="#0BA0C5" stopOpacity="0"/>
      </linearGradient>
      <linearGradient id="paint4_linear_84_430" x1="16" y1="48.7857" x2="48" y2="48.7857" gradientUnits="userSpaceOnUse">
        <stop stopColor="#117B97"/>
        <stop offset="1" stopColor="#1392B4"/>
      </linearGradient>
      <linearGradient id="paint5_linear_84_430" x1="27" y1="48.5745" x2="69.9647" y2="4.78766" gradientUnits="userSpaceOnUse">
        <stop stopColor="#3DCBFF"/>
        <stop offset="0.524843" stopColor="#6EEDED"/>
        <stop offset="1" stopColor="#9BF3AF"/>
      </linearGradient>
      <linearGradient id="paint6_linear_84_430" x1="24" y1="24" x2="31.7143" y2="24" gradientUnits="userSpaceOnUse">
        <stop stopColor="#3DCBFF"/>
        <stop offset="0.433173" stopColor="#3DCBFF" stopOpacity="0.339056"/>
        <stop offset="1" stopColor="#3DCBFF" stopOpacity="0"/>
      </linearGradient>
      <clipPath id="clip0_84_430">
        <rect width="96" height="96" fill="white"/>
      </clipPath>
      <clipPath id="clip1_84_430">
        <rect width="96" height="96" fill="white"/>
      </clipPath>
    </defs>
    <g clipPath="url(#clip0_84_430)">
      <g clipPath="url(#clip1_84_430)">
        <mask id="mask0_84_430" style={{maskType:'alpha'}} maskUnits="userSpaceOnUse" x="0" y="3" width="96" height="90">
          <path d="M24 14.3808C24 11.3548 26.2532 8.80242 29.2558 8.4271L65.2558 3.9271C68.57 3.51283 71.5261 5.87349 71.9484 9.08832L71.9993 9.08408C71.9993 11.9405 74.1264 14.35 76.9607 14.7043L90.7436 16.4271C93.7462 16.8024 95.9994 19.3548 95.9994 22.3807L95.9998 50.7873C95.9998 53.8133 93.7466 56.3657 90.744 56.7411L76.823 58.4812C74.0388 59.0365 72.0007 61.4869 72.0007 64.3646V81.7869C72.0007 84.8128 69.7475 87.3652 66.7449 87.7406L30.7447 92.2406C27.1636 92.6882 24.0005 89.8959 24.0005 86.2869L24.0005 70.3036L24 70.3808V87.0841C24 84.2276 21.873 81.8182 19.0386 81.4639L5.25579 79.741C2.25375 79.3658 0.000798971 76.8142 0 73.789L4.87281e-06 45.3808C5.18664e-06 42.3548 2.25322 39.8024 5.2558 39.4271L24 37.0841L24 14.3808Z" fill="#FFFFFF"/>
        </mask>
        <g mask="url(#mask0_84_430)">
          <path fillRule="evenodd" clipRule="evenodd" d="M95.9998 50.7032C95.9998 53.7292 93.7466 56.2817 90.744 56.657L76.823 58.3971C74.0388 58.9524 72.0007 61.4029 72.0007 64.2806V81.7028C72.0007 84.7288 69.7475 87.2812 66.7449 87.6565L30.7447 92.1565C27.1636 92.6041 24.0005 89.8118 24.0005 86.2028L24.0005 56.9995L47.9997 53.5708L47.9994 16.5209C47.9994 13.4003 50.3913 10.8007 53.5011 10.5415L71.9993 9C71.9993 11.8564 74.1264 14.2659 76.9607 14.6202L90.7436 16.343C93.7462 16.7184 95.9994 19.2707 95.9994 22.2966L95.9998 50.7032Z" fill="url(#paint0_linear_84_430)"/>
          <path d="M24 87L24 70.2967C24 67.2724 26.2507 64.7212 29.2508 64.3436L1.74845e-07 68L4.24145e-07 73.7033C5.56413e-07 76.7292 2.25322 79.2816 5.25579 79.657L19.0386 81.3798C21.873 81.7341 24 84.1436 24 87Z" fill="url(#paint1_linear_84_430)"/>
          <g filter="url(#filter0_f_84_430)">
            <path d="M5.2558 39.7431C2.25322 40.1184 5.18664e-06 42.6708 4.87281e-06 45.6967L1.79217e-06 75.4L3.1009e-06 73.6967C5.42587e-06 70.6708 2.25322 68.1184 5.25579 67.7431L42.7442 63.057C45.7468 62.6817 48 60.1293 48 57.1033L48 34.4L5.2558 39.7431Z" fill="black" fillOpacity="0.24"/>
          </g>
          <g filter="url(#filter1_f_84_430)">
            <path d="M5.2558 41.343C2.25322 41.7183 5.18664e-06 44.2708 4.87281e-06 47.2967L1.79217e-06 77L3.1009e-06 75.2967C5.42587e-06 72.2708 2.25322 69.7183 5.25579 69.343L42.7442 64.657C45.7468 64.2817 48 61.7292 48 58.7033L48 36L5.2558 41.343Z" fill="black" fillOpacity="0.32"/>
          </g>
          <path d="M5.2558 39.343C2.25322 39.7183 5.18664e-06 42.2708 4.87281e-06 45.2967L1.79217e-06 75L3.1009e-06 73.2967C5.42587e-06 70.2708 2.25322 67.7183 5.25579 67.343L42.7442 62.657C45.7468 62.2817 48 59.7292 48 56.7033L48 34L5.2558 39.343Z" fill="url(#paint2_linear_84_430)"/>
          <path d="M5.2558 39.343C2.25322 39.7183 5.18664e-06 42.2708 4.87281e-06 45.2967L1.79217e-06 75L3.1009e-06 73.2967C5.42587e-06 70.2708 2.25322 67.7183 5.25579 67.343L42.7442 62.657C45.7468 62.2817 48 59.7292 48 56.7033L48 34L5.2558 39.343Z" fill="url(#paint3_linear_84_430)" fillOpacity="0.6"/>
          <path d="M48 56.2967L48 39.2967C48 36.2724 50.2507 33.7212 53.2508 33.3436L24 37L24 42.7033C24 45.7292 26.2532 48.2816 29.2558 48.657L42.7442 50.343C45.7468 50.7183 48 53.2707 48 56.2967Z" fill="url(#paint4_linear_84_430)"/>
          <g filter="url(#filter2_f_84_430)">
            <path d="M29.2558 8.74305C26.2532 9.11837 24 11.6708 24 14.6967L24 43.4L24 42.6967C24 39.6708 26.2532 37.1184 29.2558 36.743L66.7442 32.057C69.7468 31.6817 72 29.1293 72 26.1033L72 10.1967C72 6.58773 68.8369 3.79541 65.2558 4.24305L29.2558 8.74305Z" fill="black" fillOpacity="0.24"/>
          </g>
          <g filter="url(#filter3_f_84_430)">
            <path d="M29.2558 10.343C26.2532 10.7183 24 13.2708 24 16.2967L24 45L24 44.2967C24 41.2708 26.2532 38.7183 29.2558 38.343L66.7442 33.657C69.7468 33.2817 72 30.7292 72 27.7033L72 11.7967C72 8.1877 68.8369 5.39538 65.2558 5.84302L29.2558 10.343Z" fill="black" fillOpacity="0.32"/>
          </g>
          <path d="M29.2558 8.34303C26.2532 8.71835 24 11.2708 24 14.2967L24 43L24 42.2967C24 39.2708 26.2532 36.7183 29.2558 36.343L66.7442 31.657C69.7468 31.2817 72 28.7292 72 25.7033L72 9.79669C72 6.1877 68.8369 3.39538 65.2558 3.84302L29.2558 8.34303Z" fill="url(#paint5_linear_84_430)"/>
          <path d="M29.2558 8.34303C26.2532 8.71835 24 11.2708 24 14.2967L24 43L24 42.2967C24 39.2708 26.2532 36.7183 29.2558 36.343L66.7442 31.657C69.7468 31.2817 72 28.7292 72 25.7033L72 9.79669C72 6.1877 68.8369 3.39538 65.2558 3.84302L29.2558 8.34303Z" fill="url(#paint6_linear_84_430)" fillOpacity="0.8"/>
        </g>
      </g>
    </g>
  </svg>
);

export default class SidebarAgentApplicationCustomizer
  extends BaseApplicationCustomizer<ISidebarAgentApplicationCustomizerProperties> {

  private _topPlaceholder?: PlaceholderContent;
  private _reactContainer?: HTMLDivElement;

  public onInit(): Promise<void> {
    Log.info(LOG_SOURCE, `Initialized ${strings.Title}`);
    
    if (!this.properties.appClientId || !this.properties.tenantId) {
      Log.error(LOG_SOURCE, new Error('appClientId and tenantId are required properties.'));
      return Promise.reject('Missing required properties: appClientId and tenantId');
    }
    
    if (!this.properties.directConnectUrl && (!this.properties.agentIdentifier || !this.properties.environmentId)) {
      Log.error(LOG_SOURCE, new Error('Either directConnectUrl OR both agentIdentifier and environmentId must be provided.'));
      return Promise.reject('Missing required properties: Either provide directConnectUrl OR both agentIdentifier and environmentId');
    }
    
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
