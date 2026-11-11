/** An error with a stable machine code that the UI translates (see `err.*` in the i18n dictionaries). */
export class AppError extends Error {
  readonly code: string;
  /** Raw backend message, kept only to help diagnose 'generic' failures. */
  readonly detail?: string;
  constructor(code: string, detail?: string) {
    super(code);
    this.detail = detail;
    this.name = 'AppError';
    this.code = code;
  }
}

const CODE_PATTERN = /^[a-z_]+$/;

/** Converts any thrown value (Supabase auth/PostgREST/storage errors, fetch failures) to an AppError. */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  const message =
    typeof error === 'object' && error !== null && 'message' in error ? String((error as { message: unknown }).message) : '';

  // Our SQL functions raise short snake_case codes, e.g. 'invalid_status'.
  if (CODE_PATTERN.test(message)) return new AppError(message);

  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) return new AppError('invalid_credentials');
  if (lower.includes('already registered') || lower.includes('already been registered') || lower.includes('duplicate key'))
    return new AppError('phone_taken');
  if (lower.includes('password should be') || lower.includes('weak password')) return new AppError('weak_password');
  if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('network request failed'))
    return new AppError('network');
  if (lower.includes('rate limit') || lower.includes('too many requests')) return new AppError('rate_limited');
  if (lower.includes('email not confirmed')) return new AppError('email_not_confirmed');
  console.error('[malka-express] unexpected error:', error);
  return new AppError('generic', message || undefined);
}
