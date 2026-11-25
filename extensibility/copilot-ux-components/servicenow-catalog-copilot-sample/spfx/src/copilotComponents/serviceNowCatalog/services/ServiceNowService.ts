import { AadHttpClient } from '@microsoft/sp-http';
import type { AadHttpClientFactory, HttpClientResponse } from '@microsoft/sp-http';

import { SETTINGS } from '../settings';
import type { ISnCatalogItemDetails, ISnReferenceRecord, ISubmitResult } from '../models/ICatalog';
import { toServiceNowPath } from '../utils/serviceNowPaths';

export class ServiceNowApiError extends Error {
  public constructor(message: string, public readonly statusCode: number) {
    super(message);
  }
}

interface ISnSubmitResponse {
  sys_id?: string;
  number?: string;
  request_number?: string;
  request_id?: string;
  table?: string;
  record?: string;
  redirect_portal_url?: string;
}

/**
 * Calls ServiceNow without exposing any ServiceNow secret in the browser:
 * - 'direct' mode: straight to the ServiceNow REST APIs with the user's Entra ID token
 *   (ServiceNow trusts Entra ID as an OIDC provider; CORS rules allow the call).
 * - 'apim' mode: your own Entra ID–protected API gateway (AadHttpClient).
 */
export class ServiceNowService {
  private _clientPromise: Promise<AadHttpClient> | undefined;

  public constructor(private readonly _factory: AadHttpClientFactory) {}

  public static isProducer(item: ISnCatalogItemDetails): boolean {
    return item.sys_class_name === 'sc_cat_item_producer';
  }

  /** Items that can't be submitted with order_now/submit_producer (order guides, content items). */
  public static isOrderable(item: ISnCatalogItemDetails): boolean {
    return ['sc_cat_item_guide', 'sc_cat_item_content', 'sc_cat_item_wizard'].indexOf(item.sys_class_name ?? '') < 0;
  }

  public static itemPortalUrl(sysId: string): string {
    return `${SETTINGS.serviceNowInstanceUrl}/sp?id=sc_cat_item&sys_id=${encodeURIComponent(sysId)}`;
  }

  public async getItem(sysId: string): Promise<ISnCatalogItemDetails> {
    const result = await this._request<ISnCatalogItemDetails>('GET', `/catalog/items/${encodeURIComponent(sysId)}`);
    return result;
  }

  public async searchReference(table: string, term: string): Promise<ISnReferenceRecord[]> {
    const path: string = `/reference/${encodeURIComponent(table)}?q=${encodeURIComponent(term)}`;
    return this._request<ISnReferenceRecord[]>('GET', path);
  }

  public async submit(
    item: ISnCatalogItemDetails,
    variables: Record<string, string>
  ): Promise<ISubmitResult> {
    const producer: boolean = ServiceNowService.isProducer(item);
    const operation: string = producer ? 'submit_producer' : 'order_now';
    const body: Record<string, unknown> = producer
      ? { variables }
      : { sysparm_quantity: '1', variables };

    const result: ISnSubmitResponse = await this._request<ISnSubmitResponse>(
      'POST',
      `/catalog/items/${encodeURIComponent(item.sys_id)}/${operation}`,
      body
    );

    const sysId: string = result.sys_id ?? result.request_id ?? '';
    const table: string = result.table ?? (producer ? '' : 'sc_request');
    const number: string = result.number ?? result.request_number ?? '';
    const portalUrl: string = result.redirect_portal_url
      ? new URL(result.redirect_portal_url, SETTINGS.serviceNowInstanceUrl).toString()
      : `${SETTINGS.serviceNowInstanceUrl}/sp?id=ticket&table=${encodeURIComponent(table)}&sys_id=${encodeURIComponent(sysId)}`;

    return { sysId, number, table, portalUrl };
  }

  private async _request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const response: HttpClientResponse =
      SETTINGS.apiMode === 'direct'
        ? await this._sendDirect(method, path, body)
        : await this._sendApim(method, path, body);

    const text: string = await response.text();
    let json: { result?: T; error?: { message?: string; detail?: string }; message?: string } = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      // Non-JSON error bodies (for example from a gateway) are reported by status code below.
    }

    if (!response.ok) {
      const detail: string = json.error?.message || json.error?.detail || json.message || response.statusText;
      throw new ServiceNowApiError(`ServiceNow request failed (${response.status}): ${detail}`, response.status);
    }

    return (json.result ?? (json as unknown)) as T;
  }

  private async _sendApim(method: 'GET' | 'POST', path: string, body?: unknown): Promise<HttpClientResponse> {
    const client: AadHttpClient = await this._getClient();
    const url: string = `${SETTINGS.apiBaseUrl}${path}`;
    return method === 'GET'
      ? client.get(url, AadHttpClient.configurations.v1, { headers: { Accept: 'application/json' } })
      : client.post(url, AadHttpClient.configurations.v1, {
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify(body ?? {})
        });
  }

  private async _sendDirect(method: 'GET' | 'POST', path: string, body?: unknown): Promise<HttpClientResponse> {
    const client: AadHttpClient = await this._getClient();
    const url: string = `${SETTINGS.serviceNowInstanceUrl}${toServiceNowPath(path)}`;
    const send = (): Promise<HttpClientResponse> =>
      method === 'GET'
        ? client.get(url, AadHttpClient.configurations.v1, { headers: { Accept: 'application/json' } })
        : client.post(url, AadHttpClient.configurations.v1, {
            headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify(body ?? {})
          });

    try {
      return await send();
    } catch (firstError) {
      if (firstError instanceof Error && /AADSTS/i.test(firstError.message)) {
        throw firstError;
      }
      // The first cross-origin call (CORS preflight + token) can fail transiently, for example right after
      // the instance wakes up. Retry reads once; never retry POST, which could create a duplicate request.
      if (method === 'GET') {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 800));
        try {
          return await send();
        } catch {
          // Fall through to the error below.
        }
      }
      const cause: string = firstError instanceof Error && firstError.message ? ` (${firstError.message})` : '';
      throw new ServiceNowApiError(
        `Can't reach ${SETTINGS.serviceNowInstanceUrl} from the browser${cause}. Check the ServiceNow CORS rules ` +
          'for the Service Catalog API and the Table API (reference lookups), and that the instance is awake.',
        0
      );
    }
  }

  private _getClient(): Promise<AadHttpClient> {
    if (!this._clientPromise) {
      this._clientPromise = this._factory.getClient(SETTINGS.apiResource);
    }
    return this._clientPromise;
  }
}
