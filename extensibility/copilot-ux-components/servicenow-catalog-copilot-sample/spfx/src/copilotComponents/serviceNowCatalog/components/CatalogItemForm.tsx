import * as React from 'react';
import {
  Body1,
  Button,
  Caption1,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  Spinner,
  Title3,
  makeStyles,
  tokens
} from '@fluentui/react-components';
import { ArrowLeft20Regular, Open20Regular, Send20Regular } from '@fluentui/react-icons';

import type { IFormField, ISnCatalogItemDetails, ISubmitResult } from '../models/ICatalog';
import { ServiceNowService } from '../services/ServiceNowService';
import { isPermissionError, toErrorMessage } from '../utils/errors';
import { SETTINGS } from '../settings';

// In local mode a 401/403 comes from ServiceNow (wrong proxy credentials), not from a missing API approval.
const isApiPermissionError = (error: unknown): boolean => SETTINGS.apiMode === 'apim' && isPermissionError(error);
import { htmlToText, initialValues, toFormFields, toPayload, validate } from '../utils/variables';
import type { IServiceNowCatalogStrings } from './IServiceNowCatalogProps';
import { VariableField } from './VariableField';

export interface ICatalogItemFormProps {
  sysId: string;
  fallbackTitle: string;
  service: ServiceNowService;
  strings: IServiceNowCatalogStrings;
  targetDocument: Document | undefined;
  onBack: () => void;
  onOpenLink: (url: string) => void;
  onLoaded: (item: ISnCatalogItemDetails, fields: IFormField[]) => void;
  onSubmitted: (item: ISnCatalogItemDetails, result: ISubmitResult) => void;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; item: ISnCatalogItemDetails; fields: IFormField[] }
  | { status: 'error'; message: string };

const useStyles = makeStyles({
  root: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM },
  header: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalXS },
  form: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM, maxWidth: '640px' },
  actions: { display: 'flex', gap: tokens.spacingHorizontalS, flexWrap: 'wrap' },
  description: { color: tokens.colorNeutralForeground2 }
});

export function CatalogItemForm(props: ICatalogItemFormProps): React.ReactElement {
  const { sysId, fallbackTitle, service, strings, targetDocument, onBack, onOpenLink, onLoaded, onSubmitted } = props;
  const styles = useStyles();

  const [load, setLoad] = React.useState<LoadState>({ status: 'loading' });
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [submitting, setSubmitting] = React.useState<boolean>(false);
  const [submitError, setSubmitError] = React.useState<string | undefined>(undefined);

  React.useEffect(() => {
    let cancelled: boolean = false;
    setLoad({ status: 'loading' });
    setSubmitError(undefined);
    setErrors({});

    service.getItem(sysId).then(
      (item: ISnCatalogItemDetails) => {
        if (cancelled) {
          return;
        }
        const fields: IFormField[] = toFormFields(item.variables);
        setValues(initialValues(fields));
        setLoad({ status: 'ready', item, fields });
        onLoaded(item, fields);
      },
      (error: unknown) => {
        if (!cancelled) {
          setLoad({
            status: 'error',
            message: isApiPermissionError(error) ? strings.ApiPermissionError : toErrorMessage(error, strings.GenericError)
          });
        }
      }
    );

    return () => {
      cancelled = true;
    };
  }, [service, sysId, strings, onLoaded]);

  const handleChange = React.useCallback((name: string, value: string): void => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => {
      if (!prev[name]) {
        return prev;
      }
      const next: Record<string, string> = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  const portalUrl: string = ServiceNowService.itemPortalUrl(sysId);

  if (load.status === 'loading') {
    return <Spinner size="small" label={strings.LoadingItem} />;
  }

  if (load.status === 'error') {
    return (
      <div className={styles.root}>
        <MessageBar intent="error">
          <MessageBarBody>{load.message}</MessageBarBody>
        </MessageBar>
        <div className={styles.actions}>
          <Button icon={<ArrowLeft20Regular />} onClick={onBack}>
            {strings.Back}
          </Button>
          <Button icon={<Open20Regular />} onClick={() => onOpenLink(portalUrl)}>
            {strings.OpenInServiceNow}
          </Button>
        </div>
      </div>
    );
  }

  const { item, fields } = load;
  const orderable: boolean = ServiceNowService.isOrderable(item);
  const blockedByUnsupported: boolean = fields.some((f: IFormField) => f.kind === 'unsupported' && f.required) || !!item.mandatory_attachment;
  const canSubmit: boolean = orderable && !blockedByUnsupported && !submitting;
  const description: string = item.short_description || htmlToText(item.description, targetDocument);
  const inputFields: IFormField[] = fields.filter((f: IFormField) => f.kind !== 'label');

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    const missing: string[] = validate(fields, values);
    if (missing.length > 0) {
      const nextErrors: Record<string, string> = {};
      for (const name of missing) {
        const field: IFormField | undefined = fields.find((f: IFormField) => f.name === name);
        nextErrors[name] = strings.RequiredMessage.replace('{0}', field?.label ?? name);
      }
      setErrors(nextErrors);
      setSubmitError(strings.ValidationSummary);
      return;
    }

    setSubmitting(true);
    setSubmitError(undefined);
    try {
      const result: ISubmitResult = await service.submit(item, toPayload(fields, values));
      onSubmitted(item, result);
    } catch (error) {
      setSubmitError(isApiPermissionError(error) ? strings.ApiPermissionError : toErrorMessage(error, strings.GenericError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <Title3 as="h2">{item.name || fallbackTitle}</Title3>
        {description && <Body1 className={styles.description}>{description}</Body1>}
        {item.price && item.price !== '$0.00' && <Caption1>{item.price}</Caption1>}
      </div>

      {(!orderable || blockedByUnsupported) && (
        <MessageBar intent="warning">
          <MessageBarBody>{orderable ? strings.UnsupportedMandatory : strings.NotOrderable}</MessageBarBody>
          <MessageBarActions>
            <Button size="small" onClick={() => onOpenLink(portalUrl)}>
              {strings.OpenInServiceNow}
            </Button>
          </MessageBarActions>
        </MessageBar>
      )}

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        {inputFields.length === 0 && orderable && <Body1>{strings.NoFields}</Body1>}

        {fields.map((field: IFormField, index: number) => (
          <VariableField
            key={field.name || `label-${index}`}
            field={field}
            value={values[field.name] ?? ''}
            error={errors[field.name]}
            service={service}
            strings={strings}
            onChange={handleChange}
          />
        ))}

        {submitError && (
          <MessageBar intent="error">
            <MessageBarBody>{submitError}</MessageBarBody>
          </MessageBar>
        )}

        <div className={styles.actions}>
          <Button type="submit" appearance="primary" icon={submitting ? <Spinner size="tiny" /> : <Send20Regular />} disabled={!canSubmit}>
            {submitting ? strings.Submitting : strings.Submit}
          </Button>
          <Button icon={<ArrowLeft20Regular />} onClick={onBack} disabled={submitting}>
            {strings.Back}
          </Button>
        </div>
      </form>
    </div>
  );
}
