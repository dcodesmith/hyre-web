import { describe, expect, it, vi } from "vitest";

import { resolveBookingAttempt } from "./booking-attempt";

function bookingFormData(total = "120000.00") {
  const formData = new FormData();
  formData.set("carId", "car-1");
  formData.set("expectedTotalAmount", total);
  formData.set("name", "Ada Lovelace");
  return formData;
}

describe("resolveBookingAttempt", () => {
  it("reuses the random key only while the submitted booking is unchanged", () => {
    const createKey = vi
      .fn<() => string>()
      .mockReturnValueOnce("attempt-1")
      .mockReturnValueOnce("attempt-2");
    const first = resolveBookingAttempt(null, bookingFormData(), createKey);
    const retry = resolveBookingAttempt(first, bookingFormData(), createKey);
    const changedPrice = resolveBookingAttempt(retry, bookingFormData("125000.00"), createKey);

    expect(retry).toBe(first);
    expect(changedPrice).toEqual(expect.objectContaining({ key: "attempt-2" }));
    expect(createKey).toHaveBeenCalledTimes(2);
  });

  it("ignores the previous idempotency key when comparing attempts", () => {
    const first = resolveBookingAttempt(null, bookingFormData(), () => "attempt-1");
    const retry = bookingFormData();
    retry.set("idempotencyKey", first.key);

    expect(resolveBookingAttempt(first, retry, () => "attempt-2")).toBe(first);
  });

  it("starts a new attempt when guest details change", () => {
    const first = resolveBookingAttempt(null, bookingFormData(), () => "attempt-1");
    const changed = bookingFormData();
    changed.set("name", "Grace Hopper");

    expect(resolveBookingAttempt(first, changed, () => "attempt-2").key).toBe("attempt-2");
  });
});
