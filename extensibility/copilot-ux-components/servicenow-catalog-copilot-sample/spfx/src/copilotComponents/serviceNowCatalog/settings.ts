/**
 * Environment settings for the ServiceNow catalog Copilot UX component.
 * Replace every value marked TODO before building (see the repository README).
 */
export const SETTINGS = {
  /**
   * How the component reaches ServiceNow:
   * 'direct' calls the ServiceNow REST APIs with the user's Entra ID token. ServiceNow trusts Entra ID
   *          as an OIDC provider and CORS rules allow the browser call (recommended, no gateway).
   * 'apim'   calls your own Entra ID-protected API gateway (for example Azure API Management) that
   *          exposes the same paths: /catalog/items/{sysId}, /catalog/items/{sysId}/order_now|submit_producer,
   *          /reference/{table}?q=.
   */
  apiMode: 'direct' as 'direct' | 'apim',
  /** TODO: Connection ID of the ServiceNow Catalog Copilot connector (Microsoft 365 admin center > Copilot > Connectors). */
  connectionId: 'YOUR_CONNECTOR_CONNECTION_ID',
  /** TODO: ServiceNow instance URL, without a trailing slash. REST API base in 'direct' mode and used for links. */
  serviceNowInstanceUrl: 'https://YOUR-INSTANCE.service-now.com',
  /** TODO: Application ID URI of the Entra ID app whose tokens ServiceNow (or your gateway) accepts. */
  apiResource: 'api://YOUR-ENTRA-APP-ID',
  /** Only for 'apim' mode: base URL of your gateway API. */
  apiBaseUrl: 'https://YOUR-GATEWAY.azure-api.net/servicenow',
  /** Number of catalog items fetched per keyword-search page. */
  pageSize: 15,
  /**
   * Semantic search: hits scoring within `retrievalScoreWindow` of the best hit are shown
   * (always at least `retrievalMinItems`, at most `retrievalMaxItems`); the rest are offered
   * as "possible matches". Copilot Retrieval API scores cluster closely, so a ratio cutoff doesn't work.
   */
  retrievalMaxItems: 12,
  retrievalMinItems: 3,
  retrievalScoreWindow: 0.04
};

/** Connector property names (default schema of the ServiceNow Catalog Copilot connector). */
export const CONNECTOR_FIELDS = {
  sysId: 'SysId',
  title: 'Name',
  description: 'ShortDescription',
  category: 'Category',
  type: 'Type',
  url: 'AccessUrl'
};
