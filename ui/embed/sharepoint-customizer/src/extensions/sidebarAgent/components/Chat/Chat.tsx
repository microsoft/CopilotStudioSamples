import * as React from 'react';
import { Components, createStore } from 'botframework-webchat';
import { FluentThemeProvider } from 'botframework-webchat-fluent-theme';
import { ConnectionSettings, CopilotStudioClient, CopilotStudioWebChatConnection, ScopeHelper } from '@microsoft/agents-copilotstudio-client';
import { DefaultButton, MessageBar, MessageBarType, Spinner, SpinnerSize, useTheme } from '@fluentui/react';
import { ChatConfiguration } from '../../configuration';
import { acquireToken, SignInRequiredError } from './acquireToken';
import { createConnection } from './createConnection';
import { AttachmentValidation } from './AttachmentValidation';
import { UPLOAD_ACCEPT } from './attachments';
import styles from './Chat.module.scss';

const { BasicWebChat, Composer } = Components;

export interface IChatProps {
  configuration: ChatConfiguration;
  currentUserLogin?: string;
  baseUrl: string;
}

const Chat: React.FC<IChatProps> = ({ configuration, currentUserLogin, baseUrl }) => {
  const theme = useTheme();
  // Recreating these options when busy changes resets Web Chat's transcript scroll position.
  const styleOptions = React.useMemo<React.ComponentProps<typeof Composer>['styleOptions']>(() => ({
    rootHeight: '100%',
    rootWidth: '100%',
    backgroundColor: theme.semanticColors.bodyBackground,
    bubbleBackground: theme.semanticColors.bodyBackground,
    bubbleTextColor: theme.semanticColors.bodyText,
    bubbleFromUserBackground: theme.palette.neutralLighter,
    bubbleFromUserTextColor: theme.semanticColors.bodyText,
    bubbleBorderRadius: 8,
    bubbleFromUserBorderRadius: 8,
    primaryFont: theme.fonts.medium.fontFamily,
    accent: theme.palette.themePrimary,
    disableFileUpload: !configuration.enableFileUpload,
    uploadAccept: UPLOAD_ACCEPT,
    uploadMultiple: true,
    hideTelephoneKeypadButton: true,
    partGroupDefaultOpen: false
  }), [theme, configuration.enableFileUpload]);
  const themeVariables: React.CSSProperties & Record<`--${string}`, string> = {
    '--colorNeutralForeground1': theme.semanticColors.bodyText,
    '--colorNeutralForeground2': theme.semanticColors.bodyText,
    '--colorNeutralForeground3': theme.semanticColors.bodySubtext,
    '--colorNeutralForegroundDisabled': theme.semanticColors.disabledText,
    '--colorNeutralBackground1': theme.semanticColors.bodyBackground,
    '--colorNeutralBackground1Hover': theme.palette.neutralLighter,
    '--colorNeutralBackground1Pressed': theme.palette.neutralLight,
    '--colorNeutralBackground3': theme.palette.neutralLighter,
    '--colorNeutralBackground4': theme.palette.neutralLighterAlt,
    '--colorNeutralBackground5': theme.palette.neutralLight,
    '--colorNeutralBackgroundDisabled': theme.semanticColors.disabledBackground,
    '--colorNeutralStroke1': theme.palette.neutralTertiaryAlt,
    '--colorNeutralStroke2': theme.palette.neutralLight,
    '--colorStrokeFocus2': theme.palette.themePrimary,
    '--colorBrandForeground1': theme.palette.themePrimary,
    '--colorBrandForegroundLink': theme.palette.themePrimary,
    '--colorBrandForegroundLinkHover': theme.palette.themeDark,
    '--colorBrandBackground': theme.palette.themePrimary,
    '--colorBrandBackgroundHover': theme.palette.themeDarkAlt,
    '--colorBrandBackgroundPressed': theme.palette.themeDark,
    '--colorBrandBackground2': theme.palette.themeLighterAlt,
    '--colorStatusDangerForeground1': theme.semanticColors.errorText,
    '--fontFamilyBase': theme.fonts.medium.fontFamily || '"Segoe UI", sans-serif'
  };
  const [connection, setConnection] = React.useState<CopilotStudioWebChatConnection>();
  const [error, setError] = React.useState<string>();
  const [authenticationFailed, setAuthenticationFailed] = React.useState(false);
  const [signInRequired, setSignInRequired] = React.useState(false);
  const signIn = React.useRef<() => void>();
  const [uploadError, setUploadError] = React.useState<string>();
  const [attempt, setAttempt] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const store = React.useMemo(() => createStore(), [attempt]);

  React.useEffect(() => {
    let cancelled = false;
    let activeConnection: CopilotStudioWebChatConnection | undefined;
    setError(undefined);
    setAuthenticationFailed(false);
    setSignInRequired(false);
    setUploadError(undefined);
    setConnection(undefined);
    setBusy(false);

    const initialize = async (interactive = false): Promise<void> => {
      setError(undefined);
      let acquiringToken = false;
      try {
        const settings = new ConnectionSettings({
          environmentId: configuration.environmentId,
          schemaName: configuration.schemaName,
          directConnectUrl: configuration.directConnectUrl
        });
        acquiringToken = true;
        const token = await acquireToken({
          appClientId: configuration.appClientId, tenantId: configuration.tenantId,
          currentUserLogin, redirectUri: baseUrl,
          scopes: [ScopeHelper.getScopeFromSettings(settings)]
        }, interactive);
        acquiringToken = false;
        if (cancelled) return;
        setAuthenticationFailed(false);
        setSignInRequired(false);
        activeConnection = createConnection(new CopilotStudioClient(settings, token), configuration, {
          onTurn: () => {
            setError(undefined);
            setBusy(true);
          },
          onTurnEnd: () => { if (!cancelled) setBusy(false); },
          onError: failure => {
            if (!cancelled) {
              console.error('Copilot connection failed:', failure.name);
              setError(failure.message);
            }
          }
        });
        setConnection(activeConnection);
      } catch (failure) {
        if (!cancelled) {
          setAuthenticationFailed(acquiringToken);
          if (failure instanceof SignInRequiredError) setSignInRequired(true);
          console.error('Copilot initialization failed:', failure instanceof Error ? failure.name : 'Unknown error');
          setError(failure instanceof Error ? failure.message : 'Could not connect to the agent.');
        }
      }
    };
    const connect = (interactive = false): void => {
      initialize(interactive).catch(failure => {
        if (!cancelled) setError(failure instanceof Error ? failure.message : 'Could not connect to the agent.');
      });
    };
    signIn.current = () => connect(true);
    connect();
    return () => {
      cancelled = true;
      signIn.current = undefined;
      activeConnection?.end();
    };
  }, [configuration, currentUserLogin, baseUrl, attempt]);

  return (
    <div className={styles.chat} style={themeVariables}>
      {uploadError && <MessageBar messageBarType={MessageBarType.warning} dismissButtonAriaLabel="Dismiss file warning" onDismiss={() => setUploadError(undefined)}>
        {uploadError}
      </MessageBar>}
      {error && (
        <MessageBar messageBarType={signInRequired ? MessageBarType.info : MessageBarType.error} isMultiline>
          <div className={styles.errorMessage} tabIndex={0}>{error}</div>
          {authenticationFailed && (
            <div className={styles.authDetails}>
              {signInRequired && <p>
                Select Sign in to open Microsoft sign-in. If Microsoft shows an error without redirecting back,
                its detailed message stays in that window and cannot be read by this page.
              </p>}
              <div><strong>Application ID:</strong> <code>{configuration.appClientId}</code></div>
              <div><strong>Redirect URI (Single-page application):</strong> <code>{baseUrl}</code></div>
            </div>
          )}
          <div className={styles.reconnect}>
            {signInRequired ? (
              <DefaultButton onClick={() => signIn.current?.()}>Sign in</DefaultButton>
            ) : (
              <>
                <DefaultButton onClick={() => setAttempt(previous => previous + 1)}>Reconnect</DefaultButton>
                <span>Reconnecting starts a new conversation. A failed request may already have reached the agent.</span>
              </>
            )}
          </div>
        </MessageBar>
      )}
      {!connection && !error && (
        <div className={styles.loading} role="status">
          <div>
            <Spinner size={SpinnerSize.medium} label={signInRequired ? 'Signing in...' : 'Connecting to your agent...'} />
            {signInRequired && <p>
              Complete sign-in in the pop-up. If Microsoft displays an error, that window contains the detailed sign-in message.
            </p>}
          </div>
        </div>
      )}
      {connection && (
        <FluentThemeProvider variant="copilot">
          <Composer
            directLine={connection}
            disabled={busy}
            store={store}
            styleOptions={styleOptions}
          >
            <AttachmentValidation enabled={configuration.enableFileUpload} onError={setUploadError} />
            <div className={styles.webChat}>
              <BasicWebChat />
            </div>
          </Composer>
        </FluentThemeProvider>
      )}
    </div>
  );
};

export default Chat;
