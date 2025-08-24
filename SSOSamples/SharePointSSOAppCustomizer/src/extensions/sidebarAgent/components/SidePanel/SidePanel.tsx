import * as React from 'react';
import styles from './SidePanel.module.scss';
import Chat from '../Chat/Chat';
import { ISidePanelProps } from '../../models/ISidebarAgentProperties';

export default class SidePanel extends React.Component<ISidePanelProps> {
  public render(): React.ReactElement {
    const { isOpen, properties, currentUserLogin, onDismiss, onNewConversation, chatKey } = this.props;
    const agentTitle = properties.agentTitle || 'Copilot Studio Agent';

    return (
      <>
        <div className={`${styles.sidePanel} ${isOpen ? styles.open : ''}`}>
          <div className={styles.chatContainer}>
            <div className={styles.titleBar}>
              <h3 className={styles.title}>{agentTitle}</h3>
              <div className={styles.buttonGroup}>
                <button
                  className={styles.iconButton}
                  aria-label="Start new conversation"
                  onClick={onNewConversation}
                  title="Start new conversation"
                >
                  <NewChatIcon />
                </button>
                <button
                  className={styles.iconButton}
                  aria-label="Hide panel"
                  onClick={onDismiss}
                  title="Hide panel"
                >
                  <ChevronRightIcon />
                </button>
              </div>
            </div>
            
            <div className={styles.chatWrapper}>
              <Chat
                key={chatKey}
                appClientId={properties.appClientId}
                tenantId={properties.tenantId}
                environmentId={properties.environmentId}
                agentIdentifier={properties.agentIdentifier}
                directConnectUrl={properties.directConnectUrl}
                showTyping={properties.showTyping}
                currentUserLogin={currentUserLogin}
              />
            </div>
          </div>
        </div>
        
        {isOpen && <div className={styles.overlay} onClick={onDismiss} />}
      </>
    );
  }
}

const NewChatIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10.5 2C15.1944 2 19 5.80558 19 10.5C19 15.1944 15.1944 19 10.5 19C8.76472 19 7.11922 18.4543 5.75373 17.4816L2.49213 18.5078C2.08002 18.6317 1.65087 18.4024 1.52705 17.9903C1.48179 17.8421 1.48179 17.6842 1.52705 17.536L2.5527 14.2752C1.57831 12.9086 1.0317 11.2612 1.0317 9.52322C1.08606 5.05327 4.99567 1.31044 9.46027 1.03543C9.80475 1.01197 10.1513 1 10.5 1V2ZM10.5 3C6.35786 3 3 6.35786 3 10.5C3 11.8905 3.38968 13.1911 4.06306 14.2901C4.14846 14.4308 4.20128 14.5899 4.21725 14.7554C4.23321 14.9209 4.21188 15.0886 4.15513 15.2446L3.45116 17.3484L5.55498 16.6445C5.86607 16.5406 6.20598 16.5808 6.48684 16.7547C7.58156 17.4263 8.87622 17.8142 10.2598 17.8142H10.5C14.6421 17.8142 18 14.4563 18 10.3142V10.186C17.8591 6.33426 14.9119 3.21269 11.0732 3.00673C10.8831 2.99556 10.692 2.99 10.5 2.99V3ZM10.5 5.5C10.7761 5.5 11 5.72386 11 6V9.5H14.5C14.7761 9.5 15 9.72386 15 10C15 10.2761 14.7761 10.5 14.5 10.5H11V14C11 14.2761 10.7761 14.5 10.5 14.5C10.2239 14.5 10 14.2761 10 14V10.5H6.5C6.22386 10.5 6 10.2761 6 10C6 9.72386 6.22386 9.5 6.5 9.5H10V6C10 5.72386 10.2239 5.5 10.5 5.5Z" fill="currentColor"/>
  </svg>
);

const ChevronRightIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10.2929 3.29289C10.6834 2.90237 11.3166 2.90237 11.7071 3.29289L17.7071 9.29289C18.0976 9.68342 18.0976 10.3166 17.7071 10.7071L11.7071 16.7071C11.3166 17.0976 10.6834 17.0976 10.2929 16.7071C9.90237 16.3166 9.90237 15.6834 10.2929 15.2929L15.5858 10L10.2929 4.70711C9.90237 4.31658 9.90237 3.68342 10.2929 3.29289Z" fill="currentColor"/>
  </svg>
);