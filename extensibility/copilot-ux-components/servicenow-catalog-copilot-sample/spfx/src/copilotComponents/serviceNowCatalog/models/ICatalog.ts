/** A catalog item row returned from the Copilot connector search. */
export interface ICatalogItem {
  sysId: string;
  title: string;
  description: string;
  category?: string;
  type?: string;
  url?: string;
}

export interface ICatalogSearchPage {
  items: ICatalogItem[];
  total: number;
  moreResultsAvailable: boolean;
  /** Weaker semantic matches, shown only when the user asks for them. */
  possibleMatches?: ICatalogItem[];
}

/** Choice as returned by the ServiceNow Service Catalog API. */
export interface ISnChoice {
  value: string;
  label: string;
  index?: number;
}

/** Variable as returned by `GET /api/sn_sc/servicecatalog/items/{sys_id}`. */
export interface ISnVariable {
  name?: string;
  label?: string;
  type: number;
  friendly_type?: string;
  containerType?: string;
  mandatory?: boolean;
  read_only?: boolean;
  displayvalue?: string;
  // eslint-disable-next-line @rushstack/no-new-null -- the ServiceNow API returns null values
  value?: string | boolean | number | null;
  help_text?: string;
  choices?: ISnChoice[];
  reference?: string;
  children?: ISnVariable[];
}

export interface ISnCatalogItemDetails {
  sys_id: string;
  name: string;
  short_description?: string;
  description?: string;
  sys_class_name?: string;
  price?: string;
  variables?: ISnVariable[];
  mandatory_attachment?: boolean;
}

export interface ISnReferenceRecord {
  sys_id: string;
  name: string;
}

/** Normalized result of `order_now` or `submit_producer`. */
export interface ISubmitResult {
  sysId: string;
  number: string;
  table: string;
  portalUrl: string;
}

export type FieldKind =
  | 'text'
  | 'textarea'
  | 'masked'
  | 'email'
  | 'url'
  | 'number'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'yesno'
  | 'date'
  | 'datetime'
  | 'reference'
  | 'label'
  | 'unsupported';

/** Form field derived from a ServiceNow catalog variable. */
export interface IFormField {
  kind: FieldKind;
  name: string;
  label: string;
  required: boolean;
  readOnly: boolean;
  defaultValue: string;
  defaultDisplay: string;
  helpText: string;
  options: ISnChoice[];
  referenceTable?: string;
  snType: number;
}
