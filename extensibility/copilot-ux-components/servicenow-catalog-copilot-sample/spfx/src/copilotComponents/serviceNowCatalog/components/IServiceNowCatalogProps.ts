import type {
  ICopilotComponentHostContext,
  ISPCopilotBridge,
  SPCopilotDisplayMode
} from '@microsoft/sp-copilot-component';

import type { CatalogSearchService } from '../services/CatalogSearchService';
import type { ServiceNowService } from '../services/ServiceNowService';

export type IServiceNowCatalogStrings = IServiceNowCatalogCopilotComponentStrings;

export interface IServiceNowCatalogProps {
  /** Search keywords passed by the agent. */
  initialQuery: string;
  /** Catalog item to open directly, when the agent passed a valid sys_id. */
  initialItemSysId?: string;
  hostContext: ICopilotComponentHostContext;
  bridge: ISPCopilotBridge;
  searchService: CatalogSearchService;
  serviceNowService: ServiceNowService;
  onRequestDisplayMode: (mode: SPCopilotDisplayMode) => Promise<void>;
  onRequestSizeChange: (width: number, height: number) => Promise<void>;
  /** Document that Fluent UI injects styles into (the component iframe document). */
  targetDocument: Document | undefined;
  strings: IServiceNowCatalogStrings;
}
