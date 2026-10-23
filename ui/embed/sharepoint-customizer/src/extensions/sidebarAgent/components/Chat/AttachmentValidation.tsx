import * as React from 'react';
import { hooks } from 'botframework-webchat';
import { validateFile } from './attachments';

export function AttachmentValidation({
  enabled, onError
}: { enabled: boolean; onError: (message: string) => void }): React.ReactElement {
  const [attachments, setAttachments] = hooks.useSendBoxAttachments();
  React.useEffect(() => {
    const errors: string[] = [];
    const accepted = attachments.filter(({ blob }: { blob: Blob }) => {
      try {
        if (!enabled) throw new Error('File uploads are disabled for this agent.');
        validateFile(blob instanceof File ? blob.name : '', blob.size);
        return true;
      } catch (error) {
        errors.push(error instanceof Error ? error.message : 'Could not read the selected file.');
        return false;
      }
    });
    if (errors.length) {
      setAttachments(accepted);
      onError(errors.join(' '));
    }
  }, [attachments, enabled, onError, setAttachments]);
  return <></>;
}
