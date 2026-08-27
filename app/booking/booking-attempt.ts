export interface BookingAttempt {
  readonly scope: string;
  readonly key: string;
}

export function bookingAttemptScope(formData: FormData) {
  const entries = Array.from(formData.entries()).filter(([name]) => name !== "idempotencyKey");
  return JSON.stringify(entries);
}

function createBookingAttemptKey() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function resolveBookingAttempt(
  previous: BookingAttempt | null,
  formData: FormData,
  createKey: () => string = createBookingAttemptKey,
): BookingAttempt {
  const scope = bookingAttemptScope(formData);
  return previous?.scope === scope ? previous : { scope, key: createKey() };
}
