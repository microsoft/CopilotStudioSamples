import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { BaseCopilotComponent } from '@microsoft/sp-copilot-component';
import type { SPCopilotDisplayMode } from '@microsoft/sp-copilot-component';

import ServiceNowCatalog from './components/ServiceNowCatalog';
import type { IServiceNowCatalogProps } from './components/IServiceNowCatalogProps';
import type { IServiceNowCatalogCopilotComponentProperties } from './ServiceNowCatalogCopilotComponentProperties';
import { CatalogSearchService, isValidSysId } from './services/CatalogSearchService';
import { ServiceNowService } from './services/ServiceNowService';

import * as strings from 'ServiceNowCatalogCopilotComponentStrings';

/**
 * Copilot UX component that lets users search the ServiceNow catalog (via the
 * ServiceNow Catalog Copilot connector), pick an item, fill in the item's
 * request form, and submit it to ServiceNow through Azure API Management.
 */
export default class ServiceNowCatalogCopilotComponent extends BaseCopilotComponent<IServiceNowCatalogCopilotComponentProperties> {
  private _root: Root | undefined;
  private _searchService!: CatalogSearchService;
  private _serviceNowService!: ServiceNowService;

  protected async onInit(): Promise<void> {
    // Data is loaded by the views so the component renders immediately with a loading state.
    this._searchService = new CatalogSearchService(this.context.msGraphClientFactory);
    this._serviceNowService = new ServiceNowService(this.context.aadHttpClientFactory);
  }

  protected render(): void {
    // Tool arguments are written by the model, so only accept a well-formed sys_id.
    const itemSysId: string | undefined = isValidSysId(this.properties.itemSysId)
      ? this.properties.itemSysId.trim()
      : undefined;

    const props: IServiceNowCatalogProps = {
      initialQuery: (this.properties.query ?? '').trim().slice(0, 200),
      initialItemSysId: itemSysId,
      hostContext: this.hostContext,
      bridge: this.context.copilotBridge,
      searchService: this._searchService,
      serviceNowService: this._serviceNowService,
      onRequestDisplayMode: this._requestDisplayMode,
      onRequestSizeChange: this._requestSizeChange,
      targetDocument: this.context.domElement.ownerDocument,
      strings
    };

    if (!this._root) {
      this._root = createRoot(this.context.domElement);
    }

    this._root.render(React.createElement(ServiceNowCatalog, props));
  }

  protected async onTeardown(): Promise<void> {
    this._root?.unmount();
    this._root = undefined;
  }

  // Stable references so React effects that depend on them don't re-run on every render.
  private _requestDisplayMode = async (mode: SPCopilotDisplayMode): Promise<void> => {
    await this.requestDisplayModeAsync(mode);
  };

  private _requestSizeChange = async (width: number, height: number): Promise<void> => {
    await this.requestSizeChangeAsync(width, height);
  };
}
