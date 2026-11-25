/**
 * Maps the gateway-style paths used by ServiceNowService to ServiceNow REST API paths
 * (direct mode). Without a gateway, ServiceNow ACLs and the signed-in user's catalog
 * access decide what is allowed; this only shapes well-formed requests.
 */
export function toServiceNowPath(path: string): string {
  const item: RegExpMatchArray | null = path.match(/^\/catalog\/items\/([0-9a-f]{32})(?:\/(order_now|submit_producer))?$/i);
  if (item) {
    return `/api/sn_sc/servicecatalog/items/${item[1]}${item[2] ? `/${item[2]}` : ''}`;
  }

  const reference: RegExpMatchArray | null = path.match(/^\/reference\/([a-z0-9_]+)\?q=(.*)$/i);
  if (reference) {
    const table: string = reference[1].toLowerCase();
    const term: string = decodeURIComponent(reference[2]).replace(/[\^=<>]/g, ' ').trim().slice(0, 80);
    const filter: string = table === 'sys_user' ? `active=true^nameLIKE${term}^ORemailLIKE${term}` : `nameLIKE${term}`;
    return (
      `/api/now/table/${table}?sysparm_fields=sys_id,name&sysparm_limit=15&sysparm_exclude_reference_link=true` +
      `&sysparm_query=${encodeURIComponent(`${filter}^ORDERBYname`)}`
    );
  }

  throw new Error(`Unsupported ServiceNow path: ${path}`);
}
