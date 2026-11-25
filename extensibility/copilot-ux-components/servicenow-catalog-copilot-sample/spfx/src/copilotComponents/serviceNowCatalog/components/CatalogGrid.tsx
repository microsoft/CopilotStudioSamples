import * as React from 'react';
import {
  Body1,
  Button,
  Caption1,
  Input,
  MessageBar,
  MessageBarBody,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableCellLayout,
  TableHeader,
  TableHeaderCell,
  TableRow,
  makeStyles,
  tokens
} from '@fluentui/react-components';
import { Search20Regular } from '@fluentui/react-icons';

import type { ICatalogItem, ICatalogSearchPage } from '../models/ICatalog';
import type { CatalogSearchService } from '../services/CatalogSearchService';
import { isPermissionError, toErrorMessage } from '../utils/errors';
import type { IServiceNowCatalogStrings } from './IServiceNowCatalogProps';

export interface ICatalogGridProps {
  searchService: CatalogSearchService;
  initialQuery: string;
  strings: IServiceNowCatalogStrings;
  onSelect: (item: ICatalogItem) => void;
  onResults: (query: string, items: ICatalogItem[], total: number) => void;
}

type SearchState =
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'error'; message: string };

const useStyles = makeStyles({
  root: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM },
  searchRow: { display: 'flex', gap: tokens.spacingHorizontalS, alignItems: 'center' },
  searchInput: { flexGrow: 1 },
  titleCell: { minWidth: '180px', width: '30%' },
  actionCell: { width: '110px' },
  description: { color: tokens.colorNeutralForeground2, whiteSpace: 'normal', paddingBlock: tokens.spacingVerticalS },
  footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
});

export function CatalogGrid(props: ICatalogGridProps): React.ReactElement {
  const { searchService, initialQuery, strings, onSelect, onResults } = props;
  const styles = useStyles();

  const [draftQuery, setDraftQuery] = React.useState<string>(initialQuery);
  const [query, setQuery] = React.useState<string>(initialQuery);
  const [items, setItems] = React.useState<ICatalogItem[]>([]);
  const [total, setTotal] = React.useState<number>(0);
  const [hasMore, setHasMore] = React.useState<boolean>(false);
  const [state, setState] = React.useState<SearchState>({ status: 'loading' });
  const [loadingMore, setLoadingMore] = React.useState<boolean>(false);
  const [possibleMatches, setPossibleMatches] = React.useState<ICatalogItem[]>([]);

  // A new tool invocation with different keywords restarts the search.
  React.useEffect(() => {
    setDraftQuery(initialQuery);
    setQuery(initialQuery);
  }, [initialQuery]);

  // Incremented for every new search; pending "Load more" responses from an older search are ignored.
  const searchGeneration = React.useRef<number>(0);
  const itemsRef = React.useRef<ICatalogItem[]>([]);
  const updateItems = React.useCallback((next: ICatalogItem[]): void => {
    itemsRef.current = next;
    setItems(next);
  }, []);

  React.useEffect(() => {
    let cancelled: boolean = false;
    searchGeneration.current++;
    setState({ status: 'loading' });
    setLoadingMore(false);
    updateItems([]);
    setPossibleMatches([]);

    searchService.search(query, 0).then(
      (page: ICatalogSearchPage) => {
        if (cancelled) {
          return;
        }
        updateItems(page.items);
        setTotal(page.total);
        setHasMore(page.moreResultsAvailable);
        setPossibleMatches(page.possibleMatches ?? []);
        setState({ status: 'ready' });
        onResults(query, page.items, page.total);
      },
      (error: unknown) => {
        if (!cancelled) {
          setState({
            status: 'error',
            message: isPermissionError(error) ? strings.GraphPermissionError : toErrorMessage(error, strings.GenericError)
          });
        }
      }
    );

    return () => {
      cancelled = true;
    };
  }, [searchService, query, strings, onResults, updateItems]);

  const loadMore = React.useCallback(async (): Promise<void> => {
    const generation: number = searchGeneration.current;
    setLoadingMore(true);
    try {
      const page: ICatalogSearchPage = await searchService.search(query, itemsRef.current.length);
      if (generation !== searchGeneration.current) {
        return;
      }
      const current: ICatalogItem[] = itemsRef.current;
      const merged: ICatalogItem[] = [...current, ...page.items.filter((i) => !current.some((e) => e.sysId === i.sysId))];
      updateItems(merged);
      setHasMore(page.moreResultsAvailable && page.items.length > 0);
      onResults(query, merged, page.total);
    } catch (error) {
      if (generation === searchGeneration.current) {
        setState({ status: 'error', message: toErrorMessage(error, strings.GenericError) });
      }
    } finally {
      if (generation === searchGeneration.current) {
        setLoadingMore(false);
      }
    }
  }, [searchService, query, strings, onResults, updateItems]);

  const showPossibleMatches = React.useCallback((): void => {
    const merged: ICatalogItem[] = [...items, ...possibleMatches];
    updateItems(merged);
    setTotal(merged.length);
    setPossibleMatches([]);
    onResults(query, merged, merged.length);
  }, [items, possibleMatches, query, onResults, updateItems]);

  const submitSearch = (event?: React.FormEvent): void => {
    event?.preventDefault();
    setQuery(draftQuery.trim());
  };

  const summary: string =
    query.length > 0
      ? strings.ResultsCount.replace('{0}', String(total)).replace('{1}', query)
      : strings.ResultsCountAll.replace('{0}', String(total));

  return (
    <div className={styles.root}>
      <form className={styles.searchRow} onSubmit={submitSearch} role="search">
        <Input
          className={styles.searchInput}
          value={draftQuery}
          placeholder={strings.SearchPlaceholder}
          contentBefore={<Search20Regular />}
          onChange={(_, data) => setDraftQuery(data.value)}
          aria-label={strings.SearchPlaceholder}
        />
        <Button type="submit" appearance="primary">
          {strings.SearchButton}
        </Button>
      </form>

      {state.status === 'loading' && <Spinner size="small" label={strings.LoadingResults} />}

      {state.status === 'error' && (
        <MessageBar intent="error">
          <MessageBarBody>{state.message}</MessageBarBody>
        </MessageBar>
      )}

      {state.status === 'ready' && items.length === 0 && <Body1>{strings.NoResults}</Body1>}

      {state.status === 'ready' && items.length > 0 && (
        <>
          <Caption1>{summary}</Caption1>
          <Table size="small" aria-label={strings.Heading}>
            <TableHeader>
              <TableRow>
                <TableHeaderCell className={styles.titleCell}>{strings.ColumnTitle}</TableHeaderCell>
                <TableHeaderCell>{strings.ColumnDescription}</TableHeaderCell>
                <TableHeaderCell className={styles.actionCell} aria-label={strings.ColumnAction} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item: ICatalogItem) => (
                <TableRow key={item.sysId}>
                  <TableCell className={styles.titleCell}>
                    <TableCellLayout description={item.category || undefined}>{item.title}</TableCellLayout>
                  </TableCell>
                  <TableCell>
                    <div className={styles.description}>{item.description}</div>
                  </TableCell>
                  <TableCell className={styles.actionCell}>
                    <Button
                      size="small"
                      appearance="primary"
                      onClick={() => onSelect(item)}
                      aria-label={strings.SelectButtonAriaLabel.replace('{0}', item.title)}
                    >
                      {strings.SelectButton}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {(hasMore || possibleMatches.length > 0) && (
            <div className={styles.footer}>
              <span />
              {possibleMatches.length > 0 ? (
                <Button appearance="subtle" onClick={showPossibleMatches}>
                  {strings.ShowPossibleMatches.replace('{0}', String(possibleMatches.length))}
                </Button>
              ) : (
                <Button appearance="subtle" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? <Spinner size="tiny" /> : strings.LoadMore}
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
