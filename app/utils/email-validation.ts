/**
 * Normalizes an email address to prevent plus-addressing abuse.
 *
 * Plus-addressing (RFC 5233) lets users append "+tag" to the local part
 * of their email (e.g. damola+promo@dcodesmith.com) and still receive
 * mail at the base address. This function strips those tags so the
 * system treats all variants as one identity.
 *
 * Examples:
 *   damola+1@dcodesmith.com   → damola@dcodesmith.com
 *   damola+test@dcodesmith.com → damola@dcodesmith.com
 *   damola@dcodesmith.com      → damola@dcodesmith.com (no change)
 */
export function normalizeEmail(email: string): string {
  const lowered = email.toLowerCase().trim();
  const atIndex = lowered.lastIndexOf("@");
  if (atIndex === -1) return lowered;

  const localPart = lowered.slice(0, atIndex);
  const domain = lowered.slice(atIndex + 1);

  const plusIndex = localPart.indexOf("+");
  const baseLocalPart = plusIndex === -1 ? localPart : localPart.slice(0, plusIndex);

  return `${baseLocalPart}@${domain}`;
}
