import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("cloudflare:workers", () => ({
  env: { API_ORIGIN: "https://api.invalid" },
}));

vi.mock("react-router", async () => {
  const actual = await vi.importActual<typeof import("react-router")>("react-router");
  return {
    ...actual,
    Form: ({ children, ...props }: { children?: ReactNode }) =>
      createElement("form", props, children),
    Link: ({ children, to, ...props }: { children?: ReactNode; to?: string }) =>
      createElement("a", { ...props, href: to }, children),
    useNavigation: () => ({ state: "idle" }),
  };
});

import type { FleetBookingDetail } from "~/api/fleet/bookings/schema";
import type { Route } from "./+types/fleet-owner.bookings.$bookingId";
import FleetOwnerBookingRoute from "./fleet-owner.bookings.$bookingId";

const BOOKING_ID = "018f47a2-7b3c-7d4e-8f90-123456789401";
const CAR_ID = "018f47a2-7b3c-7d4e-8f90-123456789471";

const booking = {
  id: BOOKING_ID,
  bookingReference: "TD-1001",
  status: "CONFIRMED",
  type: "DAY",
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
} satisfies FleetBookingDetail["booking"];

function renderAssignment({
  actionData,
  isOwnerDriver,
}: {
  actionData?: Route.ComponentProps["actionData"];
  isOwnerDriver: boolean;
}) {
  const props: Route.ComponentProps = {
    params: { bookingId: BOOKING_ID },
    loaderData: {
      booking,
      assignableChauffeurs: [],
      isOwnerDriver,
    },
    actionData,
    matches: [] as unknown as Route.ComponentProps["matches"],
  };
  return renderToStaticMarkup(createElement(FleetOwnerBookingRoute, props));
}

describe("fleet-owner booking assignment view", () => {
  it("shows the assignment warning before a chauffeur is saved", () => {
    const markup = renderAssignment({ isOwnerDriver: false });

    expect(markup).toContain("Assignment required");
    expect(markup).toContain("Select a chauffeur for this booking.");
    expect(markup).toContain("No chauffeur is available for this time.");
    expect(markup).toContain('href="/fleet-owner/chauffeurs"');
    expect(markup).toContain("Manage chauffeurs");
  });

  it("hides chauffeur management for an owner-driver with nobody available", () => {
    const markup = renderAssignment({ isOwnerDriver: true });

    expect(markup).toContain("No chauffeur is available for this time.");
    expect(markup).not.toContain("Manage chauffeurs");
    expect(markup).not.toContain('href="/fleet-owner/chauffeurs"');
  });

  it("hides the stale assignment warning after a successful save", () => {
    const markup = renderAssignment({ actionData: { success: true }, isOwnerDriver: false });

    expect(markup).toContain("Assignment saved");
    expect(markup).toContain("The selected chauffeur is now assigned to this booking.");
    expect(markup).not.toContain("Assignment required");
    expect(markup).not.toContain("Select a chauffeur for this booking.");
  });
});
