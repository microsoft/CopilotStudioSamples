import * as React from 'react';
import {
  Body1,
  Button,
  FluentProvider,
  IdPrefixProvider,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Subtitle1,
  makeStyles,
  tokens,
  webDarkTheme,
  webLightTheme
} from '@fluentui/react-components';
import { ArrowExpand20Regular, ArrowLeft20Regular, Open20Regular } from '@fluentui/react-icons';
import { createCopilotTextContent } from '@microsoft/sp-copilot-component';

import type { ICatalogItem, IFormField, ISnCatalogItemDetails, ISubmitResult } from '../models/ICatalog';
import { watchContentSize } from '../utils/contentSize';
import { CatalogGrid } from './CatalogGrid';
import { CatalogItemForm } from './CatalogItemForm';
import type { IServiceNowCatalogProps } from './IServiceNowCatalogProps';

type View =
  | { kind: 'list' }
  | { kind: 'form'; sysId: string; title: string; fromList: boolean }
  | { kind: 'done'; title: string; result: ISubmitResult; fromList: boolean };

const MAX_CONTEXT_ITEMS: number = 15;

const useStyles = makeStyles({
  root: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM, padding: tokens.spacingHorizontalM },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: tokens.spacingHorizontalS },
  actions: { display: 'flex', gap: tokens.spacingHorizontalS, flexWrap: 'wrap' }
});

/**
 * Root view: catalog search grid → item request form → confirmation.
 * Each step updates the Copilot model context so follow-up questions in the
 * chat ("what did I just request?") are answered from what the user sees.
 */
export default function ServiceNowCatalog(props: IServiceNowCatalogProps): React.ReactElement {
  const {
    initialQuery, initialItemSysId, hostContext, bridge, searchService, serviceNowService,
    onRequestDisplayMode, onRequestSizeChange, targetDocument, strings
  } = props;
  const styles = useStyles();
  const theme = hostContext.theme === 'dark' ? webDarkTheme : webLightTheme;
  const isFullscreen: boolean = hostContext.displayMode === 'fullscreen';

  const [view, setView] = React.useState<View>(
    initialItemSysId ? { kind: 'form', sysId: initialItemSysId, title: '', fromList: false } : { kind: 'list' }
  );
  // Kept in sync with `view` immediately, so late async callbacks see the active view.
  const viewRef = React.useRef<View>(view);
  const showView = React.useCallback((next: View): void => {
    viewRef.current = next;
    setView(next);
  }, []);
  const [listVisited, setListVisited] = React.useState<boolean>(!initialItemSysId);
  const lastListContext = React.useRef<string>('');

  const contentRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!contentRef.current) {
      return undefined;
    }
    return watchContentSize(contentRef.current, (width: number, height: number) => {
      onRequestSizeChange(width, height).catch(() => undefined);
    });
  }, [onRequestSizeChange]);

  // Context updates replace each other; chain them so an older view can't overwrite a newer one.
  const contextQueue = React.useRef<Promise<void>>(Promise.resolve());
  const publishContext = React.useCallback(
    (text: string): void => {
      contextQueue.current = contextQueue.current
        .then(() => bridge.updateModelContextAsync({ content: [createCopilotTextContent(text)] }))
        .catch(() => undefined);
    },
    [bridge]
  );

  const handleResults = React.useCallback(
    (query: string, items: ICatalogItem[], total: number): void => {
      const lines: string[] = items
        .slice(0, MAX_CONTEXT_ITEMS)
        .map((i: ICatalogItem) => `- ${i.title} (sys_id ${i.sysId})${i.description ? `: ${i.description.slice(0, 120)}` : ''}`);
      const text: string =
        `The ServiceNow catalog component shows ${items.length} of ${total} catalog items` +
        (query ? ` matching "${query}"` : '') +
        '. The user can select an item to open its request form.' +
        (lines.length > 0 ? `\nVisible items:\n${lines.join('\n')}` : '');
      lastListContext.current = text;
      // The grid stays mounted behind the form; only publish list context while the list is visible.
      if (viewRef.current.kind === 'list') {
        publishContext(text);
      }
    },
    [publishContext]
  );

  const handleSelect = React.useCallback(
    (item: ICatalogItem): void => {
      showView({ kind: 'form', sysId: item.sysId, title: item.title, fromList: true });
      if (!isFullscreen) {
        onRequestDisplayMode('fullscreen').catch(() => undefined);
      }
    },
    [isFullscreen, onRequestDisplayMode, showView]
  );

  const handleLoaded = React.useCallback(
    (item: ISnCatalogItemDetails, fields: IFormField[]): void => {
      const required: string[] = fields.filter((f: IFormField) => f.required && f.kind !== 'label').map((f: IFormField) => f.label);
      publishContext(
        `The user opened the request form for the ServiceNow catalog item "${item.name}" (sys_id ${item.sys_id}). ` +
          `The form has ${fields.filter((f: IFormField) => f.kind !== 'label').length} fields` +
          (required.length > 0 ? `; required: ${required.join(', ')}` : '') +
          '. The request has not been submitted yet.'
      );
    },
    [publishContext]
  );

  const handleSubmitted = React.useCallback(
    (item: ISnCatalogItemDetails, result: ISubmitResult): void => {
      const current: View = viewRef.current;
      showView({
        kind: 'done',
        title: item.name,
        result,
        fromList: current.kind === 'form' ? current.fromList : false
      });
      publishContext(
        `The user submitted a ServiceNow request for "${item.name}". ServiceNow created ${result.number || 'a record'} ` +
          `in table ${result.table || 'unknown'} (sys_id ${result.sysId}). Link: ${result.portalUrl}`
      );
    },
    [publishContext, showView]
  );

  const backToList = React.useCallback((): void => {
    setListVisited(true);
    showView({ kind: 'list' });
    if (lastListContext.current) {
      publishContext(lastListContext.current);
    }
  }, [publishContext, showView]);

  const openLink = React.useCallback(
    (url: string): void => {
      bridge.openLinkAsync(url).catch(() => undefined);
    },
    [bridge]
  );

  return (
    <IdPrefixProvider value="snc-">
      <FluentProvider theme={theme} targetDocument={targetDocument} style={{ minHeight: '100%' }}>
        <div ref={contentRef} className={styles.root}>
          <div className={styles.header}>
            <Subtitle1 as="h1">{strings.Heading}</Subtitle1>
            {!isFullscreen && (
              <Button
                appearance="subtle"
                icon={<ArrowExpand20Regular />}
                aria-label={strings.Expand}
                title={strings.Expand}
                onClick={() => onRequestDisplayMode('fullscreen').catch(() => undefined)}
              />
            )}
          </div>

          {/* Keep the grid mounted so results and paging survive a round trip to the form. */}
          {listVisited && (
            <div hidden={view.kind !== 'list'}>
              <CatalogGrid
                searchService={searchService}
                initialQuery={initialQuery}
                strings={strings}
                onSelect={handleSelect}
                onResults={handleResults}
              />
            </div>
          )}

          {view.kind === 'form' && (
            <CatalogItemForm
              sysId={view.sysId}
              fallbackTitle={view.title}
              service={serviceNowService}
              strings={strings}
              targetDocument={targetDocument}
              onBack={backToList}
              onOpenLink={openLink}
              onLoaded={handleLoaded}
              onSubmitted={handleSubmitted}
            />
          )}

          {view.kind === 'done' && (
            <>
              <MessageBar intent="success">
                <MessageBarBody>
                  <MessageBarTitle>{strings.SubmittedTitle}</MessageBarTitle>
                  <Body1>{strings.SubmittedBody.replace('{0}', view.result.number || view.result.sysId).replace('{1}', view.title)}</Body1>
                </MessageBarBody>
              </MessageBar>
              <div className={styles.actions}>
                <Button appearance="primary" icon={<Open20Regular />} onClick={() => openLink(view.result.portalUrl)}>
                  {strings.ViewRequest}
                </Button>
                <Button icon={<ArrowLeft20Regular />} onClick={backToList}>
                  {strings.BackToResults}
                </Button>
              </div>
            </>
          )}
        </div>
      </FluentProvider>
    </IdPrefixProvider>
  );
}
