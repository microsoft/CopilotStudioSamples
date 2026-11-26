import type { FieldKind, IFormField, ISnChoice, ISnVariable } from '../models/ICatalog';

/** ServiceNow catalog variable type codes (item_option_new.type). */
const SN_TYPE_TO_KIND: Record<number, FieldKind> = {
  1: 'yesno',
  2: 'textarea',
  3: 'radio',
  4: 'radio',
  5: 'select',
  6: 'text',
  7: 'checkbox',
  8: 'reference',
  9: 'date',
  10: 'datetime',
  11: 'label',
  16: 'text',
  18: 'select',
  22: 'radio',
  25: 'masked',
  26: 'email',
  27: 'url',
  28: 'text',
  29: 'text',
  31: 'reference',
  32: 'label'
};

/** Layout-only variable types that carry no value: break, container start/end/split, UI macro/page. */
const LAYOUT_TYPES: number[] = [12, 14, 15, 17, 19, 20, 24];

function isLayoutType(type: number): boolean {
  return LAYOUT_TYPES.indexOf(type) >= 0;
}

/** Some instances report containers as type 0 with friendly_type "container_start" / "container_end". */
function isLayout(variable: ISnVariable): boolean {
  return isLayoutType(variable.type) || /^container_/.test(variable.friendly_type ?? '') || !!variable.containerType;
}

/** The Service Catalog API returns values as strings, booleans, numbers or null. */
function valueToString(value: ISnVariable['value']): string {
  if (value === undefined || value === null) {
    return '';
  }
  return typeof value === 'string' ? value : String(value);
}

function flatten(variables: ISnVariable[]): ISnVariable[] {
  const result: ISnVariable[] = [];
  for (const variable of variables) {
    if (!isLayout(variable) || variable.label) {
      result.push(variable);
    }
    if (variable.children && variable.children.length > 0) {
      result.push(...flatten(variable.children));
    }
  }
  return result;
}

function toField(variable: ISnVariable): IFormField | undefined {
  if (isLayout(variable)) {
    // Containers with a title render as section headings.
    return variable.label
      ? {
          kind: 'label',
          name: variable.name ?? '',
          label: variable.label,
          required: false,
          readOnly: true,
          defaultValue: '',
          defaultDisplay: '',
          helpText: '',
          options: [],
          snType: variable.type
        }
      : undefined;
  }

  let kind: FieldKind = SN_TYPE_TO_KIND[variable.type] ?? 'unsupported';
  const options: ISnChoice[] = (variable.choices ?? [])
    .filter((c: ISnChoice) => c.value !== undefined && c.value !== null)
    .map((c: ISnChoice) => ({ value: String(c.value), label: c.label ?? String(c.value), index: c.index }))
    .sort((a: ISnChoice, b: ISnChoice) => (a.index ?? 0) - (b.index ?? 0));

  // A numeric scale or multiple choice without choices can only be entered as a number/text.
  if ((kind === 'radio' || kind === 'select') && options.length === 0) {
    kind = variable.type === 4 ? 'number' : 'text';
  }

  const referenceTable: string | undefined =
    kind === 'reference' ? variable.reference || (variable.type === 31 ? 'sys_user' : undefined) : undefined;

  return {
    kind,
    name: variable.name ?? '',
    label: variable.label || variable.name || '',
    required: !!variable.mandatory,
    readOnly: !!variable.read_only,
    defaultValue: valueToString(variable.value),
    defaultDisplay: variable.displayvalue ?? valueToString(variable.value),
    helpText: variable.help_text ?? '',
    options,
    referenceTable,
    snType: variable.type
  };
}

/** Converts the ServiceNow variable tree into an ordered list of form fields. */
export function toFormFields(variables: ISnVariable[] | undefined): IFormField[] {
  return flatten(variables ?? [])
    .map(toField)
    .filter((field: IFormField | undefined): field is IFormField => !!field && (field.kind === 'label' || field.name.length > 0));
}

export function initialValues(fields: IFormField[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of fields) {
    if (field.kind === 'label' || field.kind === 'unsupported') {
      continue;
    }
    values[field.name] = field.kind === 'datetime' ? toDateTimeLocal(field.defaultValue) : field.defaultValue;
  }
  return values;
}

/** Returns the names of required fields that are empty. */
export function validate(fields: IFormField[], values: Record<string, string>): string[] {
  return fields
    .filter((f: IFormField) => f.required && !f.readOnly && f.kind !== 'label' && f.kind !== 'unsupported')
    .filter((f: IFormField) => {
      const value: string = (values[f.name] ?? '').trim();
      if (f.kind === 'checkbox') {
        return value !== 'true';
      }
      return value.length === 0;
    })
    .map((f: IFormField) => f.name);
}

/** Builds the `variables` payload expected by order_now / submit_producer. */
export function toPayload(fields: IFormField[], values: Record<string, string>): Record<string, string> {
  const payload: Record<string, string> = {};
  for (const field of fields) {
    if (field.kind === 'label' || field.kind === 'unsupported') {
      continue;
    }
    const value: string = values[field.name] ?? '';
    if (value === '' && field.kind !== 'checkbox') {
      continue;
    }
    payload[field.name] = field.kind === 'datetime' ? fromDateTimeLocal(value) : field.kind === 'checkbox' ? value || 'false' : value;
  }
  return payload;
}

/** `yyyy-MM-dd HH:mm:ss` (ServiceNow) → `yyyy-MM-ddTHH:mm` (input type=datetime-local). */
export function toDateTimeLocal(value: string): string {
  const match: RegExpMatchArray | null = value.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
  return match ? `${match[1]}T${match[2]}` : '';
}

/** `yyyy-MM-ddTHH:mm` → `yyyy-MM-dd HH:mm:ss`. */
export function fromDateTimeLocal(value: string): string {
  const match: RegExpMatchArray | null = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?/);
  return match ? `${match[1]} ${match[2]}:${match[3] ?? '00'}` : value;
}

/** Plain-text version of a ServiceNow HTML description. */
export function htmlToText(html: string | undefined, doc: Document | undefined): string {
  if (!html) {
    return '';
  }
  const container: HTMLElement | undefined = doc?.createElement('div');
  if (!container) {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  container.innerHTML = html;
  return (container.textContent ?? '').replace(/\s+/g, ' ').trim();
}
