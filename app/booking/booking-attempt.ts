export interface BookingAttempt {
  readonly scope: string;
  readonly key: string;
}

export function bookingAttemptScope(formData: FormData) {
  const scopedData = new FormData();

  for (const [name, value] of formData) {
    if (name !== "idempotencyKey") {
      scopedData.append(name, value);
    }
  }

  return JSON.stringify(Array.from(scopedData.entries()));
}

export function resolveBookingAttempt(
  previous: BookingAttempt | null,
  formData: FormData,
  createKey: () => string = () => crypto.randomUUID(),
): BookingAttempt {
  const scope = bookingAttemptScope(formData);
  return previous?.scope === scope ? previous : { scope, key: createKey() };
}
