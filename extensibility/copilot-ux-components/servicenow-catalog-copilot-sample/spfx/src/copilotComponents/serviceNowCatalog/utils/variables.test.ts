import type { IFormField, ISnVariable } from '../models/ICatalog';
import { fromDateTimeLocal, initialValues, toDateTimeLocal, toFormFields, toPayload, validate } from './variables';

const variables: ISnVariable[] = [
  {
    type: 19,
    label: 'Details',
    children: [
      { type: 6, name: 'justification', label: 'Justification', mandatory: true, value: '' },
      {
        type: 5,
        name: 'edition',
        label: 'Edition',
        choices: [
          { value: 'pro', label: 'Pro', index: 2 },
          { value: 'std', label: 'Standard', index: 1 }
        ]
      }
    ]
  },
  { type: 20 },
  { type: 7, name: 'agree', label: 'I agree', mandatory: true },
  { type: 10, name: 'needed_by', label: 'Needed by', value: '2026-12-01 09:30:00' },
  { type: 31, name: 'requested_for', label: 'Requested for' },
  { type: 21, name: 'apps', label: 'Apps' }
];

describe('toFormFields', () => {
  const fields: IFormField[] = toFormFields(variables);

  it('flattens containers into a heading followed by their children', () => {
    expect(fields.map((f) => f.kind)).toEqual(['label', 'text', 'select', 'checkbox', 'datetime', 'reference', 'unsupported']);
    expect(fields[0].label).toBe('Details');
  });

  it('sorts choices by index and maps reference tables', () => {
    expect(fields[2].options.map((o) => o.value)).toEqual(['std', 'pro']);
    expect(fields[5].referenceTable).toBe('sys_user');
  });

  it('validates required fields and builds the payload', () => {
    const values: Record<string, string> = initialValues(fields);
    expect(values.needed_by).toBe('2026-12-01T09:30');
    expect(validate(fields, values)).toEqual(['justification', 'agree']);

    values.justification = 'Design work';
    values.agree = 'true';
    expect(validate(fields, values)).toEqual([]);
    expect(toPayload(fields, values)).toEqual({
      justification: 'Design work',
      agree: 'true',
      needed_by: '2026-12-01 09:30:00'
    });
  });
});

describe('real ServiceNow shapes (Standard Laptop on a PDI)', () => {
  const laptop: ISnVariable[] = [
    {
      type: 0,
      friendly_type: 'container_start',
      containerType: 'checkbox_container',
      name: 'optional_label',
      label: 'Optional Software',
      value: null,
      children: [
        { type: 7, name: 'acrobat', label: 'Adobe Acrobat', value: false, displayvalue: 'false' },
        { type: 7, name: 'photoshop', label: 'Adobe Photoshop', value: false, displayvalue: 'false' }
      ]
    },
    { type: 2, name: 'Additional_software_requirements', label: 'Additional software requirements', value: '' }
  ];

  it('treats type 0 containers as headings and coerces boolean values', () => {
    const fields: IFormField[] = toFormFields(laptop);
    expect(fields.map((f) => `${f.kind}:${f.name}`)).toEqual([
      'label:optional_label',
      'checkbox:acrobat',
      'checkbox:photoshop',
      'textarea:Additional_software_requirements'
    ]);
    const values: Record<string, string> = initialValues(fields);
    expect(values.acrobat).toBe('false');
    values.photoshop = 'true';
    expect(toPayload(fields, values)).toEqual({ acrobat: 'false', photoshop: 'true' });
  });
});

describe('date/time conversion', () => {
  it('round-trips ServiceNow date/time values', () => {
    expect(toDateTimeLocal('2026-01-02 03:04:05')).toBe('2026-01-02T03:04');
    expect(fromDateTimeLocal('2026-01-02T03:04')).toBe('2026-01-02 03:04:00');
    expect(toDateTimeLocal('')).toBe('');
  });
});
