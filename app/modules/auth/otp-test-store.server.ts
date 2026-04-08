/**
 * In-memory OTP store used exclusively during E2E testing.
 *
 * When E2E_TESTING=true, the sendVerificationOTP callback stores
 * plain-text OTPs here so that Playwright tests can retrieve them
 * via the /api/test/otp endpoint. The store is never used in
 * production — the guard is checked at write and read time.
 */

const otpStore = new Map<string, { otp: string; timestamp: number }>();

const MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

export function isE2ETesting(): boolean {
  return process.env.E2E_TESTING === "true";
}

export function storeTestOTP(email: string, otp: string): void {
  if (!isE2ETesting()) return;
  otpStore.set(email.toLowerCase(), { otp, timestamp: Date.now() });
}

export function retrieveTestOTP(email: string): string | null {
  if (!isE2ETesting()) return null;

  const entry = otpStore.get(email.toLowerCase());
  if (!entry) return null;

  if (Date.now() - entry.timestamp > MAX_AGE_MS) {
    otpStore.delete(email.toLowerCase());
    return null;
  }

  return entry.otp;
}

export function clearTestOTPs(): void {
  otpStore.clear();
}
