import * as React from 'react';
import {
  Checkbox,
  Dropdown,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Option,
  Radio,
  RadioGroup,
  Subtitle2,
  Textarea,
  useId
} from '@fluentui/react-components';

import type { IFormField, ISnChoice } from '../models/ICatalog';
import type { ServiceNowService } from '../services/ServiceNowService';
import { ReferencePicker } from './ReferencePicker';
import type { IServiceNowCatalogStrings } from './IServiceNowCatalogProps';

export interface IVariableFieldProps {
  field: IFormField;
  value: string;
  error?: string;
  service: ServiceNowService;
  strings: IServiceNowCatalogStrings;
  onChange: (name: string, value: string) => void;
}

const INPUT_TYPES: Partial<Record<IFormField['kind'], 'text' | 'email' | 'url' | 'number' | 'password' | 'date' | 'datetime-local'>> = {
  text: 'text',
  email: 'email',
  url: 'url',
  number: 'number',
  masked: 'password',
  date: 'date',
  datetime: 'datetime-local'
};

/** Renders one ServiceNow catalog variable as a Fluent UI form control. */
export function VariableField(props: IVariableFieldProps): React.ReactElement {
  const { field, value, service, strings, onChange } = props;
  const labelId: string = useId('sn-label');
  const [lookupError, setLookupError] = React.useState<string | undefined>(undefined);
  const handleLookupError = React.useCallback((message: string | undefined) => setLookupError(message), []);

  if (field.kind === 'label') {
    return <Subtitle2 as="h3">{field.label}</Subtitle2>;
  }

  if (field.kind === 'unsupported') {
    return (
      <MessageBar intent={field.required ? 'warning' : 'info'}>
        <MessageBarBody>{strings.UnsupportedField.replace('{0}', field.label)}</MessageBarBody>
      </MessageBar>
    );
  }

  const set = (next: string): void => onChange(field.name, next);
  const validationMessage: string | undefined = props.error ?? lookupError;

  let control: React.ReactElement;
  switch (field.kind) {
    case 'textarea':
      control = <Textarea value={value} resize="vertical" disabled={field.readOnly} onChange={(_, d) => set(d.value)} />;
      break;

    case 'select': {
      const selected: ISnChoice | undefined = field.options.find((o: ISnChoice) => o.value === value);
      control = (
        <Dropdown
          aria-labelledby={labelId}
          placeholder={strings.SelectPlaceholder}
          disabled={field.readOnly}
          value={selected?.label ?? ''}
          selectedOptions={value ? [value] : []}
          onOptionSelect={(_, d) => set(d.optionValue ?? '')}
        >
          {!field.required && (
            <Option value="" text={strings.NoneOption}>
              {strings.NoneOption}
            </Option>
          )}
          {field.options.map((o: ISnChoice) => (
            <Option key={o.value} value={o.value} text={o.label}>
              {o.label}
            </Option>
          ))}
        </Dropdown>
      );
      break;
    }

    case 'radio':
      control = (
        <RadioGroup value={value} disabled={field.readOnly} onChange={(_, d) => set(d.value)}>
          {field.options.map((o: ISnChoice) => (
            <Radio key={o.value} value={o.value} label={o.label} />
          ))}
        </RadioGroup>
      );
      break;

    case 'yesno':
      control = (
        <RadioGroup layout="horizontal" value={value} disabled={field.readOnly} onChange={(_, d) => set(d.value)}>
          <Radio value="Yes" label={strings.Yes} />
          <Radio value="No" label={strings.No} />
        </RadioGroup>
      );
      break;

    case 'checkbox':
      return (
        <Field validationMessage={validationMessage} hint={field.helpText || undefined}>
          <Checkbox
            label={field.label}
            required={field.required}
            checked={value === 'true'}
            disabled={field.readOnly}
            onChange={(_, d) => set(d.checked ? 'true' : 'false')}
          />
        </Field>
      );

    case 'reference':
      control = (
        <ReferencePicker
          table={field.referenceTable ?? ''}
          value={value}
          initialDisplay={field.defaultDisplay}
          disabled={field.readOnly || !field.referenceTable}
          service={service}
          strings={strings}
          ariaLabelledBy={labelId}
          onChange={set}
          onError={handleLookupError}
        />
      );
      break;

    default:
      control = (
        <Input type={INPUT_TYPES[field.kind] ?? 'text'} value={value} disabled={field.readOnly} onChange={(_, d) => set(d.value)} />
      );
  }

  return (
    <Field
      label={{ children: field.label, id: labelId }}
      required={field.required}
      hint={field.helpText || undefined}
      validationMessage={validationMessage}
    >
      {control}
    </Field>
  );
}
