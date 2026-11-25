export function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'object' && error && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return fallback;
}

/** True when the failure is caused by missing API consent or authorization. */
export function isPermissionError(error: unknown): boolean {
  if (typeof error !== 'object' || !error) {
    return false;
  }
  const candidate = error as { statusCode?: number; message?: string };
  if (candidate.statusCode === 401 || candidate.statusCode === 403) {
    return true;
  }
  return /AADSTS65001|AADSTS500011|consent|Authorization_RequestDenied/i.test(candidate.message ?? '');
}
