import { parseWithZod } from "@conform-to/zod/v4";
import { describe, expect, it } from "vitest";

import { EMAIL_INVALID_ERROR } from "~/auth/auth-form-schema";
import {
  AIRPORT_PICKUP_TIME,
  BOOKING_DATES_ERROR,
  createBookingFormSchema,
  DROP_OFF_ADDRESS_ERROR,
  FLIGHT_NUMBER_ERROR,
  GUEST_NAME_ERROR,
  GUEST_PHONE_ERROR,
  NIGHT_PICKUP_TIME,
  PICKUP_ADDRESS_ERROR,
  PICKUP_TIME_ERROR,
  resolveCreatePickupTime,
  toBookingApiWindow,
  toCreateBookingBody,
  toPricingPreviewBody,
} from "./booking-create-form-schema";

const signedIn = createBookingFormSchema(false);
const guest = createBookingFormSchema(true);

function signedInDay() {
  return {
    carId: "cmmz4f7x00000l804jj2d6ikn",
    idempotencyKey: "18aa029c-4bb1-4ca7-b25e-cfc802c4bf8c",
    expectedTotalAmount: "120000.00",
    bookingType: "DAY" as const,
    from: "2026-09-01",
    to: "2026-09-01",
    pickupTime: "9 AM",
    pickupAddress: "Lekki Phase 1",
    sameLocation: "true" as const,
  };
}

describe("createBookingFormSchema", () => {
  it("accepts a signed-in same-location day booking", () => {
    expect(signedIn.parse(signedInDay())).toMatchObject({
      bookingType: "DAY",
      sameLocation: "true",
      pickupAddress: "Lekki Phase 1",
    });
  });

  it("requires guest name, email, and phone", () => {
    const result = guest.safeParse(signedInDay());

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }

    const fields = result.error.flatten().fieldErrors;
    expect(fields.name?.[0]).toBe(GUEST_NAME_ERROR);
    expect(fields.email?.[0]).toBe(EMAIL_INVALID_ERROR);
    expect(fields.phoneNumber?.[0]).toBe(GUEST_PHONE_ERROR);
  });

  it("maps empty guest fields from FormData the way Conform submits them", () => {
    const formData = new FormData();
    formData.set("carId", "cmmz4f7x00000l804jj2d6ikn");
    formData.set("idempotencyKey", "18aa029c-4bb1-4ca7-b25e-cfc802c4bf8c");
    formData.set("expectedTotalAmount", "120000.00");
    formData.set("bookingType", "DAY");
    formData.set("from", "2026-09-01");
    formData.set("to", "2026-09-01");
    formData.set("pickupTime", "9 AM");
    formData.set("pickupAddress", "Lekki Phase 1");
    formData.set("sameLocation", "true");
    formData.set("name", "");
    formData.set("email", "");
    formData.set("phoneNumber", "");

    const submission = parseWithZod(formData, { schema: guest });

    expect(submission.status).toBe("error");
    if (submission.status !== "error") {
      return;
    }

    expect(submission.error?.name).toContain(GUEST_NAME_ERROR);
    expect(submission.error?.email).toContain(EMAIL_INVALID_ERROR);
    expect(submission.error?.phoneNumber).toContain(GUEST_PHONE_ERROR);
  });

  it("reports pickup, flight, drop-off, and guest errors together", () => {
    const formData = new FormData();
    formData.set("carId", "cmmz4f7x00000l804jj2d6ikn");
    formData.set("idempotencyKey", "18aa029c-4bb1-4ca7-b25e-cfc802c4bf8c");
    formData.set("expectedTotalAmount", "120000.00");
    formData.set("bookingType", "AIRPORT_PICKUP");
    formData.set("from", "2026-08-21");
    formData.set("to", "2026-08-21");
    formData.set("sameLocation", "false");
    formData.set("pickupAddress", "");
    formData.set("dropOffAddress", "");
    formData.set("flightNumber", "");
    formData.set("name", "");
    formData.set("email", "");
    formData.set("phoneNumber", "");

    const submission = parseWithZod(formData, { schema: guest });

    expect(submission.status).toBe("error");
    if (submission.status !== "error") {
      return;
    }

    expect(submission.error?.pickupAddress).toContain(PICKUP_ADDRESS_ERROR);
    expect(submission.error?.flightNumber).toContain(FLIGHT_NUMBER_ERROR);
    expect(submission.error?.dropOffAddress).toContain(DROP_OFF_ADDRESS_ERROR);
    expect(submission.error?.name).toContain(GUEST_NAME_ERROR);
    expect(submission.error?.email).toContain(EMAIL_INVALID_ERROR);
    expect(submission.error?.phoneNumber).toContain(GUEST_PHONE_ERROR);
  });

  it("requires pickup time for day bookings and a flight for airport", () => {
    expect(signedIn.safeParse({ ...signedInDay(), pickupTime: "" }).success).toBe(false);
    expect(
      signedIn.safeParse({
        ...signedInDay(),
        bookingType: "AIRPORT_PICKUP",
        sameLocation: "false",
        dropOffAddress: "Victoria Island",
        flightNumber: "",
      }).success,
    ).toBe(false);

    const missingTime = signedIn.safeParse({ ...signedInDay(), pickupTime: "" });
    if (!missingTime.success) {
      expect(missingTime.error.flatten().fieldErrors.pickupTime?.[0]).toBe(PICKUP_TIME_ERROR);
    }

    const missingFlight = signedIn.safeParse({
      ...signedInDay(),
      bookingType: "AIRPORT_PICKUP",
      sameLocation: "false",
      dropOffAddress: "Victoria Island",
    });
    if (!missingFlight.success) {
      expect(missingFlight.error.flatten().fieldErrors.flightNumber?.[0]).toBe(FLIGHT_NUMBER_ERROR);
    }
  });

  it("requires a drop-off address when sameLocation is false", () => {
    const result = signedIn.safeParse({ ...signedInDay(), sameLocation: "false" });

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }

    expect(result.error.flatten().fieldErrors.dropOffAddress?.[0]).toBe(DROP_OFF_ADDRESS_ERROR);
  });

  it("rejects missing dates from FormData", () => {
    const formData = new FormData();
    formData.set("carId", "cmmz4f7x00000l804jj2d6ikn");
    formData.set("idempotencyKey", "18aa029c-4bb1-4ca7-b25e-cfc802c4bf8c");
    formData.set("expectedTotalAmount", "120000.00");
    formData.set("bookingType", "DAY");
    formData.set("from", "");
    formData.set("to", "");
    formData.set("pickupTime", "9 AM");
    formData.set("pickupAddress", "Lekki Phase 1");
    formData.set("sameLocation", "true");

    const submission = parseWithZod(formData, { schema: signedIn });

    expect(submission.status).toBe("error");
    if (submission.status !== "error") {
      return;
    }

    expect(submission.error?.from).toContain(BOOKING_DATES_ERROR);
  });

  it("rejects impossible calendar dates", () => {
    const result = signedIn.safeParse({
      ...signedInDay(),
      from: "2026-02-30",
      to: "2026-02-30",
    });

    expect(result.success).toBe(false);
  });
});

describe("create booking payload", () => {
  it("uses night and airport pickup defaults", () => {
    expect(resolveCreatePickupTime("NIGHT", undefined)).toBe(NIGHT_PICKUP_TIME);
    expect(resolveCreatePickupTime("AIRPORT_PICKUP", "")).toBe(AIRPORT_PICKUP_TIME);
    expect(resolveCreatePickupTime("DAY", "8 AM")).toBe("8 AM");
  });

  it("builds preview and guest create bodies", () => {
    const value = guest.parse({
      ...signedInDay(),
      name: "Ada Lovelace",
      email: "  Ada@Tripdly.com ",
      phoneNumber: "08012345678",
    });
    const preview = toPricingPreviewBody(value);
    const create = toCreateBookingBody(value, "120000.00");

    expect(preview).toMatchObject({
      carId: value.carId,
      bookingType: "DAY",
      pickupTime: "9 AM",
      startDate: "2026-09-01T08:00:00.000Z",
      endDate: "2026-09-01T20:00:00.000Z",
      useCredits: 0,
    });
    expect(create).toMatchObject({
      expectedTotalAmount: "120000.00",
      sameLocation: true,
      guestName: "Ada Lovelace",
      guestEmail: "ada@tripdly.com",
      guestPhone: "08012345678",
    });
    expect(create).not.toHaveProperty("dropOffAddress");
  });

  it("omits submitted guest identity fields from signed-in booking bodies", () => {
    const value = signedIn.parse({
      ...signedInDay(),
      name: "Submitted Name",
      email: "submitted@example.com",
      phoneNumber: "08012345678",
    });

    const body = toCreateBookingBody(value);
    expect(body).not.toHaveProperty("guestName");
    expect(body).not.toHaveProperty("guestEmail");
    expect(body).not.toHaveProperty("guestPhone");
  });

  it("submits the canonical flight number", () => {
    const value = signedIn.parse({
      ...signedInDay(),
      bookingType: "AIRPORT_PICKUP",
      sameLocation: "false",
      flightNumber: " ba 74 ",
      dropOffAddress: "Victoria Island",
    });

    expect(toCreateBookingBody(value)).toMatchObject({ flightNumber: "BA74" });
  });

  it("sends a same-day DAY window from pickup through 12 hours later", () => {
    const window = toBookingApiWindow({
      bookingType: "DAY",
      from: "2026-09-01",
      to: "2026-09-01",
      pickupTime: "7 AM",
    });

    expect(window).toEqual({
      startDate: "2026-09-01T06:00:00.000Z",
      endDate: "2026-09-01T18:00:00.000Z",
    });
    expect(window && window.endDate > window.startDate).toBe(true);
  });

  it("supports a noon DAY pickup without constructing an invalid clock hour", () => {
    expect(
      toBookingApiWindow({
        bookingType: "DAY",
        from: "2026-09-01",
        to: "2026-09-01",
        pickupTime: "12 PM",
      }),
    ).toEqual({
      startDate: "2026-09-01T11:00:00.000Z",
      endDate: "2026-09-01T23:00:00.000Z",
    });
  });

  it("sends a NIGHT window from 11 PM through 5 AM the next morning", () => {
    expect(
      toBookingApiWindow({
        bookingType: "NIGHT",
        from: "2026-09-01",
        to: "2026-09-02",
        pickupTime: undefined,
      }),
    ).toEqual({
      startDate: "2026-09-01T22:00:00.000Z",
      endDate: "2026-09-02T04:00:00.000Z",
    });
  });

  it("sends a FULL_DAY window as 24 hours per selected calendar day", () => {
    expect(
      toBookingApiWindow({
        bookingType: "FULL_DAY",
        from: "2026-09-01",
        to: "2026-09-02",
        pickupTime: "6 AM",
      }),
    ).toEqual({
      startDate: "2026-09-01T05:00:00.000Z",
      endDate: "2026-09-02T05:00:00.000Z",
    });
    expect(
      toBookingApiWindow({
        bookingType: "FULL_DAY",
        from: "2026-09-01",
        to: "2026-09-03",
        pickupTime: "10 AM",
      }),
    ).toEqual({
      startDate: "2026-09-01T09:00:00.000Z",
      endDate: "2026-09-03T09:00:00.000Z",
    });
  });

  it("sends an AIRPORT_PICKUP calendar-day window and expands a same-day selection", () => {
    expect(
      toBookingApiWindow({
        bookingType: "AIRPORT_PICKUP",
        from: "2026-09-01",
        to: "2026-09-01",
        pickupTime: undefined,
      }),
    ).toEqual({
      startDate: "2026-08-31T23:00:00.000Z",
      endDate: "2026-09-01T23:00:00.000Z",
    });
  });
});
