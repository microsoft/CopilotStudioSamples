import * as React from 'react';
import { Combobox, Option, Spinner } from '@fluentui/react-components';

import type { ISnReferenceRecord } from '../models/ICatalog';
import type { ServiceNowService } from '../services/ServiceNowService';
import { toErrorMessage } from '../utils/errors';
import type { IServiceNowCatalogStrings } from './IServiceNowCatalogProps';

export interface IReferencePickerProps {
  table: string;
  value: string;
  initialDisplay: string;
  disabled: boolean;
  service: ServiceNowService;
  strings: IServiceNowCatalogStrings;
  ariaLabelledBy?: string;
  onChange: (sysId: string) => void;
  onError: (message: string | undefined) => void;
}

const DEBOUNCE_MS: number = 300;

/** Type-ahead lookup for ServiceNow reference variables (sys_user, cmn_location, ...). */
export function ReferencePicker(props: IReferencePickerProps): React.ReactElement {
  const { table, value, initialDisplay, disabled, service, strings, onChange, onError } = props;

  const [text, setText] = React.useState<string>(initialDisplay);
  const [records, setRecords] = React.useState<ISnReferenceRecord[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);
  // Only search after the user types; the pre-filled display value (e.g. the signed-in user) needs no lookup.
  const [userTyped, setUserTyped] = React.useState<boolean>(false);

  React.useEffect(() => {
    const term: string = text.trim();
    if (!userTyped || term.length < 2) {
      setRecords([]);
      return undefined;
    }

    let cancelled: boolean = false;
    const handle: number = window.setTimeout(() => {
      setLoading(true);
      service.searchReference(table, term).then(
        (result: ISnReferenceRecord[]) => {
          if (!cancelled) {
            setRecords(result);
            setLoading(false);
            onError(undefined);
          }
        },
        (error: unknown) => {
          if (!cancelled) {
            setRecords([]);
            setLoading(false);
            onError(toErrorMessage(error, strings.GenericError));
          }
        }
      );
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [text, userTyped, table, service, strings, onError]);

  return (
    <Combobox
      freeform
      disabled={disabled}
      value={text}
      selectedOptions={value ? [value] : []}
      placeholder={strings.ReferencePlaceholder}
      aria-labelledby={props.ariaLabelledBy}
      expandIcon={loading ? <Spinner size="extra-tiny" /> : undefined}
      onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
        setUserTyped(true);
        setText(event.target.value);
        if (value) {
          onChange('');
        }
      }}
      onOptionSelect={(_, data) => {
        onChange(data.optionValue ?? '');
        setText(data.optionText ?? '');
      }}
    >
      {text.trim().length < 2 ? (
        <Option disabled value="" text="">
          {strings.ReferenceMinChars}
        </Option>
      ) : records.length === 0 && !loading ? (
        <Option disabled value="" text="">
          {strings.NoMatches}
        </Option>
      ) : (
        records.map((record: ISnReferenceRecord) => (
          <Option key={record.sys_id} value={record.sys_id} text={record.name}>
            {record.name}
          </Option>
        ))
      )}
    </Combobox>
  );
}
