import { toServiceNowPath } from './serviceNowPaths';

describe('toServiceNowPath (direct mode)', () => {
  const sysId: string = '04b7e94b4f7b4200086eeed18110c7fd';

  it('maps item details and submit operations to the Service Catalog API', () => {
    expect(toServiceNowPath(`/catalog/items/${sysId}`)).toBe(`/api/sn_sc/servicecatalog/items/${sysId}`);
    expect(toServiceNowPath(`/catalog/items/${sysId}/order_now`)).toBe(`/api/sn_sc/servicecatalog/items/${sysId}/order_now`);
    expect(toServiceNowPath(`/catalog/items/${sysId}/submit_producer`)).toBe(
      `/api/sn_sc/servicecatalog/items/${sysId}/submit_producer`
    );
  });

  it('maps reference lookups to the Table API and strips query operators', () => {
    const path: string = toServiceNowPath('/reference/sys_user?q=' + encodeURIComponent('abel^ORactive=false'));
    expect(path.indexOf('/api/now/table/sys_user?sysparm_fields=sys_id,name&sysparm_limit=15')).toBe(0);
    const query: string = decodeURIComponent(path.split('sysparm_query=')[1]);
    expect(query).toBe('active=true^nameLIKEabel ORactive false^ORemailLIKEabel ORactive false^ORDERBYname');
  });

  it('rejects anything else', () => {
    expect(() => toServiceNowPath('/catalog/items/not-a-sys-id')).toThrow();
    expect(() => toServiceNowPath('/api/now/table/sys_user')).toThrow();
  });
});