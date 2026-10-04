import { RouterContextProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { assignFleetBookingChauffeur, getFleetBooking } = vi.hoisted(() => ({
  assignFleetBookingChauffeur: vi.fn(),
  getFleetBooking: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({
  env: { API_ORIGIN: "https://api.invalid" },
}));

vi.mock("~/api/fleet/bookings/bookings.server", () => ({
  assignFleetBookingChauffeur,
  getFleetBooking,
}));

import { ApiRequestError } from "~/api/api.server";
import type { FleetOwnerOnboarding } from "~/api/fleet/onboarding/schema";
import { HTTP_STATUS } from "~/api/http-status";
import type { FleetOwnerRequestContext } from "~/fleet/fleet-owner-context";
import { fleetOwnerContext } from "~/fleet/fleet-owner-context";
import type { Route } from "./+types/fleet-owner.bookings.$bookingId";
import { action, headers, loader, shouldRevalidate } from "./fleet-owner.bookings.$bookingId";

const BOOKING_ID = "018f47a2-7b3c-7d4e-8f90-123456789401";
const CHAUFFEUR_ID = "018f47a2-7b3c-7d4e-8f90-1234567894a1";
const CAR_ID = "018f47a2-7b3c-7d4e-8f90-123456789471";

const booking = {
  id: BOOKING_ID,
  bookingReference: "TD-1001",
  status: "CONFIRMED" as const,
  type: "DAY" as const,
  startDate: "2026-08-21T08:00:00.000Z",
  endDate: "2026-08-21T20:00:00.000Z",
  pickupLocation: "Ikeja",
  returnLocation: "Marina",
  specialRequests: null,
  flightNumber: null,
  customerName: "Ada Lovelace",
  car: {
    id: CAR_ID,
    make: "Honda",
    model: "Accord",
    year: 2024,
    registrationNumber: "ABC-123DE",
  },
  chauffeur: null,
  canAssignChauffeur: true,
};

const assignableChauffeurs = [
  {
    id: CHAUFFEUR_ID,
    name: "Bola Adebayo",
    image: null,
    isOwnerDriver: false,
  },
];

function verifiedOnboarding(isOwnerDriver: boolean): FleetOwnerOnboarding {
  return {
    status: "VERIFIED",
    accountType: "INDIVIDUAL",
    isOwnerDriver,
    emailVerified: true,
    phone: { number: "**********5678", verified: true },
    identity: { status: "SUCCEEDED", legalName: "JOHN DOE", businessName: null },
    bank: {
      bankName: "GTBank",
      accountName: "JOHN DOE",
      accountNumber: "******6789",
      verified: true,
    },
    documents: { driversLicense: null, lasdri: null },
    requiredActions: [],
    steps: {
      contact: "VERIFIED",
      identity: "VERIFIED",
      payout: "VERIFIED",
      driving: isOwnerDriver ? "COMPLETED" : "SKIPPED",
      submission: "VERIFIED",
    },
    nextAction: "COMPLETE",
  };
}

function fleetContext(isOwnerDriver: boolean): FleetOwnerRequestContext {
  return {
    user: {
      id: "018f47a2-7b3c-7d4e-8f90-123456789461",
      email: "owner@example.com",
      name: "Fleet Owner",
      roles: ["fleetOwner"],
    },
    onboarding: verifiedOnboarding(isOwnerDriver),
  };
}

function routeArgs(bookingId = BOOKING_ID, isOwnerDriver = false): Route.LoaderArgs {
  const request = new Request(`https://tripdly.com/fleet-owner/bookings/${bookingId}`);
  const context = new RouterContextProvider();
  context.set(fleetOwnerContext, fleetContext(isOwnerDriver));
  return {
    request,
    url: new URL(request.url),
    pattern: "/fleet-owner/bookings/:bookingId",
    params: { bookingId },
    context,
  };
}

function actionArgs(fields: Record<string, string>, bookingId = BOOKING_ID): Route.ActionArgs {
  const body = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    body.set(name, value);
  }
  const args = routeArgs(bookingId);
  return {
    ...args,
    request: new Request(args.request.url, { method: "POST", body }),
  };
}

function apiError(status: number, detail: string, kind: ApiRequestError["kind"] = "http") {
  return new ApiRequestError(kind, status, {
    type: "FLEET_BOOKING_ERROR",
    title: "Booking error",
    status,
    detail,
  });
}

describe("fleet-owner booking detail route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getFleetBooking.mockResolvedValue({
      data: { booking, assignableChauffeurs },
    });
    assignFleetBookingChauffeur.mockResolvedValue({
      data: { id: BOOKING_ID, chauffeur: { id: CHAUFFEUR_ID } },
    });
  });

  it("returns private no-store headers from the route", () => {
    expect(headers()).toEqual({ "Cache-Control": "private, no-store" });
  });

  it("loads the booking and whether the account is an owner-driver", async () => {
    const args = routeArgs(BOOKING_ID, true);

    await expect(loader(args)).resolves.toEqual({
      booking,
      assignableChauffeurs,
      isOwnerDriver: true,
    });
    expect(getFleetBooking).toHaveBeenCalledWith({
      request: args.request,
      bookingId: BOOKING_ID,
    });
  });

  it("returns not found for a malformed booking id without calling the API", async () => {
    const result = await loader(routeArgs("not-a-uuid")).catch((error: unknown) => error);

    expect(getFleetBooking).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      data: null,
      init: {
        status: HTTP_STATUS.NOT_FOUND,
        headers: { "Cache-Control": "private, no-store" },
      },
    });
  });

  it.each([
    [HTTP_STATUS.BAD_REQUEST, "Booking id is invalid"],
    [HTTP_STATUS.NOT_FOUND, "Booking not found"],
  ])("maps an API %s to a route not found", async (status, detail) => {
    getFleetBooking.mockRejectedValueOnce(apiError(status, detail));

    const result = await loader(routeArgs()).catch((error: unknown) => error);

    expect(result).toMatchObject({
      data: null,
      init: {
        status: HTTP_STATUS.NOT_FOUND,
        headers: { "Cache-Control": "private, no-store" },
      },
    });
  });

  it("rethrows API failures that are not a missing booking", async () => {
    const error = apiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, "database exploded");
    getFleetBooking.mockRejectedValueOnce(error);

    await expect(loader(routeArgs())).rejects.toBe(error);
  });

  it("rejects an action for a malformed booking id", async () => {
    const result = await action(actionArgs({ chauffeurId: CHAUFFEUR_ID }, "not-a-uuid")).catch(
      (error: unknown) => error,
    );

    expect(assignFleetBookingChauffeur).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      init: { status: HTTP_STATUS.NOT_FOUND },
    });
  });

  it("asks for a chauffeur when the submitted id is invalid", async () => {
    const missing = await action(actionArgs({}));
    const invalid = await action(actionArgs({ chauffeurId: "not-a-uuid" }));

    expect(assignFleetBookingChauffeur).not.toHaveBeenCalled();
    for (const result of [missing, invalid]) {
      expect(result).toMatchObject({
        data: { error: "Select a chauffeur before continuing." },
        init: {
          status: HTTP_STATUS.BAD_REQUEST,
          headers: { "Cache-Control": "private, no-store" },
        },
      });
    }
  });

  it("assigns the selected chauffeur", async () => {
    const args = actionArgs({ chauffeurId: CHAUFFEUR_ID });

    const result = await action(args);

    expect(assignFleetBookingChauffeur).toHaveBeenCalledWith({
      request: args.request,
      bookingId: BOOKING_ID,
      chauffeurId: CHAUFFEUR_ID,
    });
    expect(result).toMatchObject({
      data: { success: true },
      init: { headers: { "Cache-Control": "private, no-store" } },
    });
  });

  it("returns the upstream detail when assignment conflicts", async () => {
    assignFleetBookingChauffeur.mockRejectedValueOnce(
      apiError(HTTP_STATUS.CONFLICT, "The selected chauffeur is not available for this booking."),
    );

    const result = await action(actionArgs({ chauffeurId: CHAUFFEUR_ID }));

    expect(result).toMatchObject({
      data: { error: "The selected chauffeur is not available for this booking." },
      init: { status: HTTP_STATUS.CONFLICT, headers: { "Cache-Control": "private, no-store" } },
    });
  });

  it("hides server failures behind a generic assignment error", async () => {
    assignFleetBookingChauffeur.mockRejectedValueOnce(
      apiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, "database exploded"),
    );

    const result = await action(actionArgs({ chauffeurId: CHAUFFEUR_ID }));

    expect(result).toMatchObject({
      data: { error: "Unable to assign this chauffeur. Please try again." },
      init: { status: HTTP_STATUS.INTERNAL_SERVER_ERROR },
    });
    expect(JSON.stringify(result)).not.toContain("database exploded");
  });

  it("reports an unexpected failure as a bad gateway", async () => {
    assignFleetBookingChauffeur.mockRejectedValueOnce(new Error("socket hang up"));

    const result = await action(actionArgs({ chauffeurId: CHAUFFEUR_ID }));

    expect(result).toMatchObject({
      data: { error: "Unable to assign this chauffeur. Please try again." },
      init: { status: HTTP_STATUS.BAD_GATEWAY },
    });
    expect(JSON.stringify(result)).not.toContain("socket hang up");
  });

  it("rethrows an aborted assignment", async () => {
    const error = apiError(HTTP_STATUS.CLIENT_CLOSED_REQUEST, "cancelled", "aborted");
    assignFleetBookingChauffeur.mockRejectedValueOnce(error);

    await expect(action(actionArgs({ chauffeurId: CHAUFFEUR_ID }))).rejects.toBe(error);
  });

  it("reloads the booking after a failed assignment", () => {
    expect(
      shouldRevalidate({
        actionResult: { error: "The selected chauffeur is not available for this booking." },
        actionStatus: HTTP_STATUS.CONFLICT,
        defaultShouldRevalidate: false,
      } as Parameters<typeof shouldRevalidate>[0]),
    ).toBe(true);
  });

  it("keeps the default revalidation after a successful assignment", () => {
    expect(
      shouldRevalidate({
        actionResult: { success: true },
        defaultShouldRevalidate: false,
      } as Parameters<typeof shouldRevalidate>[0]),
    ).toBe(false);
    expect(
      shouldRevalidate({
        actionResult: { success: true },
        defaultShouldRevalidate: true,
      } as Parameters<typeof shouldRevalidate>[0]),
    ).toBe(true);
  });
});
