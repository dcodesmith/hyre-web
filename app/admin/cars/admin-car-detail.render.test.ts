import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-router", () => ({
  Link: ({ children, to }: { children?: ReactNode; to: string }) =>
    createElement("a", { href: to }, children),
  useFetcher: () => ({
    state: "idle",
    data: undefined,
    Form: ({ children }: { children?: ReactNode }) => createElement("form", null, children),
  }),
}));

import { AdminCarDetail } from "./admin-car-detail";
import type { AdminCarDetailData } from "./car-approval";

const baseCar = {
  id: "018f47a2-7b3c-7d4e-8f90-123456789101",
  make: "Toyota",
  model: "Camry",
  year: 2020,
  color: "Black",
  registrationNumber: "KJA123AB",
  approvalStatus: "PENDING",
  approvalNotes: null,
  passengerCapacity: 5,
  vehicleType: "SEDAN",
  vehicleVerification: null,
  documents: [],
  images: [],
  owner: {
    email: "owner@example.com",
    name: "Fleet Owner",
    username: null,
  },
} satisfies AdminCarDetailData;

describe("admin car detail warnings", () => {
  it("renders provider warnings when verification returned attention items", () => {
    const warning = "NHTSA returned a partial VIN decode (codes: 1, 400).";
    const markup = renderToStaticMarkup(
      createElement(AdminCarDetail, {
        car: {
          ...baseCar,
          vehicleVerification: { providerWarnings: [warning] },
        },
        query: { page: 1, limit: 20 },
        role: "admin",
      }),
    );

    expect(markup).toContain("Vehicle verification needs attention");
    expect(markup).toContain(warning);
  });

  it("omits the warning alert when providerWarnings is empty", () => {
    const markup = renderToStaticMarkup(
      createElement(AdminCarDetail, {
        car: {
          ...baseCar,
          vehicleVerification: { providerWarnings: [] },
        },
        query: { page: 1, limit: 20 },
        role: "admin",
      }),
    );

    expect(markup).not.toContain("Vehicle verification needs attention");
  });
});
