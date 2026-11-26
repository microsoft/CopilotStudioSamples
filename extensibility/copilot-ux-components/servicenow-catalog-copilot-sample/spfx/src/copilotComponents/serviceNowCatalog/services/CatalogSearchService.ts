import type { MSGraphClientFactory, MSGraphClientV3 } from '@microsoft/sp-http';

import { CONNECTOR_FIELDS, SETTINGS } from '../settings';
import type { ICatalogItem, ICatalogSearchPage } from '../models/ICatalog';

interface IGraphSearchHit {
  hitId?: string;
  summary?: string;
  resource?: { properties?: Record<string, unknown> };
}

interface IGraphSearchResponse {
  value?: Array<{
    hitsContainers?: Array<{
      hits?: IGraphSearchHit[];
      total?: number;
      moreResultsAvailable?: boolean;
    }>;
  }>;
}

const SYS_ID_PATTERN: RegExp = /^[0-9a-f]{32}$/i;

export function isValidSysId(value: string | undefined): value is string {
  return !!value && SYS_ID_PATTERN.test(value.trim());
}

/** Reads a property case-insensitively because Graph search can change property casing. */
function readProp(props: Record<string, unknown>, name: string): string {
  const key: string | undefined = Object.keys(props).find((k) => k.toLowerCase() === name.toLowerCase());
  const value: unknown = key ? props[key] : undefined;
  if (value === undefined || value === null) {
    return '';
  }
  return Array.isArray(value) ? value.join(', ') : String(value);
}

function stripHighlights(text: string): string {
  return text.replace(/<\/?c0>|<ddd\/>/g, '').trim();
}

interface IRetrievalHit {
  webUrl?: string;
  extracts?: Array<{ text?: string; relevanceScore?: number }>;
  resourceType?: string;
  resourceMetadata?: Record<string, unknown>;
}

interface IRetrievalResponse {
  retrievalHits?: IRetrievalHit[];
}

/** Maximum allowed by the Copilot Retrieval API. */
const MAX_RETRIEVAL_RESULTS: number = 25;

/** Best extract relevance (0–1) of a retrieval hit. */
function hitScore(hit: IRetrievalHit): number {
  return (hit.extracts ?? []).reduce((best: number, e) => Math.max(best, e.relevanceScore ?? 0), 0);
}

/**
 * The Retrieval API is optimized for recall, so weakly related items come back too.
 * Relevance scores cluster closely (for example 0.65–0.75), so a ratio cutoff doesn't work;
 * relevant items sit within a small window below the best score. Hits inside the window
 * (and at least `retrievalMinItems`) are primary; the rest are "possible matches".
 */
export function splitRelevantHits(hits: IRetrievalHit[]): { primary: IRetrievalHit[]; secondary: IRetrievalHit[] } {
  const scored = hits
    .map((hit: IRetrievalHit) => ({ hit, score: hitScore(hit) }))
    .sort((a, b) => b.score - a.score);
  const top: number = scored.length > 0 ? scored[0].score : 0;
  if (top === 0) {
    // No scores returned: keep the API's own ordering.
    return { primary: hits.slice(0, SETTINGS.retrievalMaxItems), secondary: hits.slice(SETTINGS.retrievalMaxItems) };
  }
  const cutoff: number = top - SETTINGS.retrievalScoreWindow;
  const primary: IRetrievalHit[] = [];
  const secondary: IRetrievalHit[] = [];
  scored.forEach((s, index: number) => {
    const inWindow: boolean = s.score >= cutoff || index < SETTINGS.retrievalMinItems;
    (inWindow && primary.length < SETTINGS.retrievalMaxItems ? primary : secondary).push(s.hit);
  });
  return { primary, secondary };
}

function connectorFields(): string[] {
  return Object.keys(CONNECTOR_FIELDS).map((k: string) => CONNECTOR_FIELDS[k as keyof typeof CONNECTOR_FIELDS]);
}

function toCatalogItem(props: Record<string, unknown>, fallbackDescription: string, fallbackUrl?: string): ICatalogItem {
  return {
    sysId: readProp(props, CONNECTOR_FIELDS.sysId),
    title: readProp(props, CONNECTOR_FIELDS.title),
    description: readProp(props, CONNECTOR_FIELDS.description) || fallbackDescription,
    category: readProp(props, CONNECTOR_FIELDS.category),
    type: readProp(props, CONNECTOR_FIELDS.type),
    url: readProp(props, CONNECTOR_FIELDS.url) || fallbackUrl
  };
}

function uniqueValidItems(items: ICatalogItem[]): ICatalogItem[] {
  const seen: Record<string, boolean> = {};
  return items.filter((item: ICatalogItem) => {
    if (!isValidSysId(item.sysId) || item.title.length === 0 || seen[item.sysId.toLowerCase()]) {
      return false;
    }
    seen[item.sysId.toLowerCase()] = true;
    return true;
  });
}

/**
 * Finds catalog items in the ServiceNow Catalog Copilot connector.
 * - With a query: the Microsoft 365 Copilot Retrieval API (semantic retrieval from the same
 *   index that grounds Copilot), falling back to keyword search if it returns nothing or fails.
 * - Without a query (browse) or for paging: the Microsoft Search API (keyword).
 */
export class CatalogSearchService {
  private _clientPromise: Promise<MSGraphClientV3> | undefined;

  public constructor(private readonly _factory: MSGraphClientFactory) {}

  public async search(query: string, from: number): Promise<ICatalogSearchPage> {
    const trimmed: string = query.trim();
    if (trimmed.length > 0 && from === 0) {
      try {
        const page: ICatalogSearchPage = await this._retrieve(trimmed);
        if (page.items.length > 0) {
          return page;
        }
      } catch (error) {
        // Retrieval needs a Microsoft 365 Copilot license; keyword search still works without one.
        console.warn('[ServiceNowCatalog] Copilot Retrieval API failed, using keyword search instead.', error);
      }
    }
    return this._keywordSearch(trimmed, from);
  }

  private async _retrieve(queryString: string): Promise<ICatalogSearchPage> {
    const client: MSGraphClientV3 = await this._getClient();
    const response: IRetrievalResponse = await client.api('/copilot/retrieval').version('v1.0').post({
      queryString: queryString.slice(0, 1500),
      dataSource: 'externalItem',
      dataSourceConfiguration: {
        externalItem: { connections: [{ connectionId: SETTINGS.connectionId }] }
      },
      resourceMetadata: connectorFields(),
      maximumNumberOfResults: MAX_RETRIEVAL_RESULTS
    });

    const toItem = (hit: IRetrievalHit): ICatalogItem =>
      toCatalogItem(hit.resourceMetadata ?? {}, (hit.extracts?.[0]?.text ?? '').trim(), hit.webUrl);
    const { primary, secondary } = splitRelevantHits(response.retrievalHits ?? []);
    const items: ICatalogItem[] = uniqueValidItems(primary.map(toItem));
    const possibleMatches: ICatalogItem[] = uniqueValidItems(secondary.map(toItem)).filter(
      (p: ICatalogItem) => !items.some((i: ICatalogItem) => i.sysId === p.sysId)
    );

    // Retrieval returns a single page; weaker matches are offered separately.
    return { items, total: items.length, moreResultsAvailable: false, possibleMatches };
  }

  private async _keywordSearch(query: string, from: number): Promise<ICatalogSearchPage> {
    const client: MSGraphClientV3 = await this._getClient();
    const queryString: string = query.length > 0 ? query : '*';

    const response: IGraphSearchResponse = await client.api('/search/query').post({
      requests: [
        {
          entityTypes: ['externalItem'],
          contentSources: [`/external/connections/${SETTINGS.connectionId}`],
          query: { queryString },
          from,
          size: SETTINGS.pageSize,
          fields: connectorFields()
        }
      ]
    });

    const container = response.value?.[0]?.hitsContainers?.[0];
    const items: ICatalogItem[] = uniqueValidItems(
      (container?.hits ?? []).map((hit: IGraphSearchHit) =>
        toCatalogItem(hit.resource?.properties ?? {}, stripHighlights(hit.summary ?? ''))
      )
    );

    return {
      items,
      total: container?.total ?? items.length,
      moreResultsAvailable: !!container?.moreResultsAvailable
    };
  }

  private _getClient(): Promise<MSGraphClientV3> {
    if (!this._clientPromise) {
      this._clientPromise = this._factory.getClient('3');
    }
    return this._clientPromise;
  }
}
