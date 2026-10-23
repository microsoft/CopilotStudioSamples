import * as React from 'react';
import { IconButton, Panel, PanelType, useTheme } from '@fluentui/react';
import styles from './SidePanel.module.scss';
import Chat from '../Chat/Chat';
import { ISidePanelProps } from '../../models/ISidebarAgentProperties';
import { normalizeConfiguration } from '../../configuration';

const SidePanel: React.FC<ISidePanelProps> = ({
  isOpen, properties, currentUserLogin, baseUrl, onDismiss, onNewConversation, chatKey
}) => {
  const theme = useTheme();
  const configuration = React.useMemo(() => normalizeConfiguration(properties), [properties]);
  return (
    <Panel
      isOpen={isOpen}
      isHiddenOnDismiss
      isLightDismiss
      onDismiss={onDismiss}
      type={PanelType.custom}
      customWidth="min(480px, 100vw)"
      headerText={properties.agentTitle || 'Copilot Studio Agent'}
      hasCloseButton={false}
      className={styles.sidePanel}
      styles={{
        main: { background: theme.semanticColors.bodyBackground },
        contentInner: { display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 },
        scrollableContent: { display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1, overflow: 'hidden' },
        content: { display: 'flex', flexDirection: 'column', padding: 0, flex: 1, minHeight: 0 },
        commands: { display: 'none' }
      }}
      onRenderHeader={(panelProps, defaultRender, headerTextId?: string) => (
        <div className={styles.header} style={{ borderBottom: `1px solid ${theme.palette.neutralLight}` }}>
          <h2 className={styles.title} id={headerTextId} title={properties.agentTitle || 'Copilot Studio Agent'}>
            {properties.agentTitle || 'Copilot Studio Agent'}
          </h2>
          <IconButton
            ariaLabel="New conversation"
            onClick={onNewConversation}
            title="Start a new conversation"
            iconProps={{ iconName: 'Refresh' }}
          />
          <IconButton
            ariaLabel="Collapse agent panel"
            onClick={onDismiss}
            title="Collapse agent panel"
            iconProps={{ iconName: 'ChevronRight' }}
          />
        </div>
      )}
    >
      <Chat
        key={chatKey}
        configuration={configuration}
        currentUserLogin={currentUserLogin}
        baseUrl={(baseUrl || window.location.origin).replace(/\/$/, '')}
      />
    </Panel>
  );
};

export default SidePanel;
