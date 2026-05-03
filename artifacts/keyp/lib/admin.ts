/**
 * Client-side admin gate. The server is the canonical source of truth — this
 * mirror just lets us decide whether to show the Admin Dashboard menu link
 * before the `/admin/me` round-trip resolves. The list MUST stay in sync
 * with `artifacts/api-server/src/lib/adminAuth.ts`.
 */
const ADMIN_EMAILS = new Set<string>(['xrissohn@xrisp.com']);

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.has(email.toLowerCase());
}

export function getAdminEmails(): string[] {
  return Array.from(ADMIN_EMAILS);
}
