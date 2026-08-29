// Supabase rejects with a plain object ({ message, details, hint, code }), not
// an Error, so `err instanceof Error ? err.message : fallback` quietly throws
// the reason away and shows the fallback instead. That matters most on
// participant screens, where the reason is the whole message — "this employee
// ID is already registered to someone else" is useless as "Could not start".
//
// This returns the message alone. `describeError` in the upload flow appends
// the Postgres code and hint on purpose; that detail helps a trainer debugging
// their own session, but means nothing to someone about to take a quiz.
export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message
  if (err && typeof err === 'object') {
    const { message } = err as { message?: unknown }
    if (typeof message === 'string' && message.trim()) return message
  }
  if (typeof err === 'string' && err.trim()) return err
  return fallback
}
