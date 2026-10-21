import type { ZodError } from 'zod';

export interface FieldError {
  key: 'required' | 'min' | 'max' | 'wholeNumber' | 'invalidDate' | string;
  params?: Record<string, number | string>;
}

/** Turn Zod issues into error keys the UI can translate. Only the first issue per field is kept. */
export function issuesToErrors(error: ZodError): Record<string, FieldError> {
  const out: Record<string, FieldError> = {};
  for (const issue of error.issues) {
    const name = String(issue.path[0] ?? '');
    if (!name || out[name]) continue;
    const anyIssue = issue as unknown as Record<string, unknown>;
    if (issue.code === 'too_small') out[name] = { key: 'min', params: { min: Number(anyIssue.minimum) } };
    else if (issue.code === 'too_big') out[name] = { key: 'max', params: { max: Number(anyIssue.maximum) } };
    else if (issue.code === 'invalid_type')
      out[name] = { key: anyIssue.expected === 'int' ? 'wholeNumber' : 'required' };
    else if (issue.code === 'invalid_format') out[name] = { key: 'invalidDate' };
    else if (issue.code === 'custom') out[name] = { key: issue.message };
    else out[name] = { key: 'invalid' };
  }
  return out;
}
