export const MAX_FILE_BYTES = 15 * 1024 * 1024;
const contentTypes: Record<string, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  csv: 'text/csv',
  pdf: 'application/pdf',
  txt: 'text/plain',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif'
};
export const UPLOAD_ACCEPT = Object.keys(contentTypes).map(extension => `.${extension}`).join(',');

export function validateFile(name: string, size: number): string {
  const extension = name.split('.').pop()?.toLowerCase() || '';
  const contentType = Object.prototype.hasOwnProperty.call(contentTypes, extension) ? contentTypes[extension] : undefined;
  if (!contentType) throw new Error(`${name || 'This file'} is not supported. Use DOCX, CSV, PDF, TXT, JPG, PNG, WebP, or a nonanimated GIF.`);
  if (!Number.isFinite(size) || size <= 0) throw new Error(`${name} is empty or could not be read.`);
  if (size > MAX_FILE_BYTES) throw new Error(`${name} exceeds the 15 MiB file limit. Choose a smaller file.`);
  return contentType;
}

export interface LocalAttachment {
  name?: string;
  contentType: string;
  contentUrl?: string;
}

export async function prepareAttachments<T extends LocalAttachment>(
  attachments: T[], enabled: boolean, read: typeof fetch = fetch
): Promise<T[]> {
  if (attachments.length && !enabled) throw new Error('File uploads are disabled for this agent.');
  return Promise.all(attachments.map(async attachment => {
    if (!attachment.contentUrl?.startsWith('blob:')) {
      throw new Error('Choose a local file to attach. Remote attachment URLs are not supported.');
    }
    const response = await read(attachment.contentUrl);
    if (!response.ok) throw new Error(`Could not read ${attachment.name || 'the attachment'}. Remove it and attach it again.`);
    const blob = await response.blob();
    const contentType = validateFile(attachment.name || '', blob.size);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 8192) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
    }
    return { ...attachment, contentType, contentUrl: `data:${contentType};base64,${btoa(binary)}` };
  }));
}
