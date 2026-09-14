import { describe, expect, it } from "vitest";

import {
  chauffeurInvitationExchangeSchema,
  chauffeurOnboardingSchema,
  chauffeurPhoneVerificationSchema,
  fleetOwnerChauffeurSchema,
  fleetOwnerChauffeursSchema,
} from "./schema";

const complianceRequirements = [
  { type: "LASDRI", label: "LASDRI card", required: false },
  { type: "LASRRA", label: "LASRRA card", required: false },
  { type: "DRIVER_BADGE", label: "Lagos driver badge", required: false },
] as const;

const invitedOnboarding = {
  id: "018f47a2-7b3c-7d4e-8f90-1234567894a1",
  name: "Bola Adebayo",
  email: "bola@example.com",
  phoneNumber: "+2348012345678",
  fleetOwnerName: "Ada Lovelace",
  status: "INVITED",
  steps: { consent: false, phone: false, nin: false, driving: false },
  complianceRequirements,
} as const;

const approvedOnboarding = {
  ...invitedOnboarding,
  status: "APPROVED",
  fleetOwnerName: null,
  steps: { consent: true, phone: true, nin: true, driving: true },
} as const;

const fleetChauffeur = {
  id: "018f47a2-7b3c-7d4e-8f90-1234567894b1",
  chauffeurId: "018f47a2-7b3c-7d4e-8f90-1234567894a1",
  name: "Bola Adebayo",
  email: "bola@example.com",
  phoneNumber: "+2348012345678",
  status: "APPROVED",
  isActive: true,
  image: null,
  invitedAt: "2026-08-20T12:00:00.000Z",
} as const;

describe("chauffeur API schemas", () => {
  it("parses invited and approved onboarding contracts", () => {
    expect(chauffeurOnboardingSchema.parse(invitedOnboarding)).toEqual(invitedOnboarding);
    expect(chauffeurOnboardingSchema.parse(approvedOnboarding)).toMatchObject({
      status: "APPROVED",
      fleetOwnerName: null,
      steps: { consent: true, phone: true, nin: true, driving: true },
    });
  });

  it("rejects an unknown onboarding status", () => {
    expect(
      chauffeurOnboardingSchema.safeParse({
        ...invitedOnboarding,
        status: "PENDING",
      }).success,
    ).toBe(false);
  });

  it("parses invitation exchange, phone verification, and fleet chauffeur list contracts", () => {
    expect(
      chauffeurInvitationExchangeSchema.parse({
        sessionToken: "session-token",
        sessionExpiresAt: "2026-09-11T12:00:00.000Z",
        onboarding: invitedOnboarding,
      }),
    ).toMatchObject({
      sessionToken: "session-token",
      onboarding: { id: "018f47a2-7b3c-7d4e-8f90-1234567894a1", status: "INVITED" },
    });
    expect(
      chauffeurPhoneVerificationSchema.parse({
        status: "PENDING",
        phoneNumber: "+2348012345678",
      }),
    ).toEqual({ status: "PENDING", phoneNumber: "+2348012345678" });
    expect(fleetOwnerChauffeurSchema.parse(fleetChauffeur)).toEqual(fleetChauffeur);
    expect(
      fleetOwnerChauffeursSchema.parse({
        items: [fleetChauffeur],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
        complianceRequirements,
      }),
    ).toMatchObject({
      items: [{ chauffeurId: "018f47a2-7b3c-7d4e-8f90-1234567894a1", status: "APPROVED" }],
      meta: { page: 1, total: 1 },
    });
  });

  it("rejects a malformed invitation expiry or chauffeur email", () => {
    expect(
      chauffeurInvitationExchangeSchema.safeParse({
        sessionToken: "session-token",
        sessionExpiresAt: "2026-09-11",
        onboarding: invitedOnboarding,
      }).success,
    ).toBe(false);
    expect(
      fleetOwnerChauffeurSchema.safeParse({
        ...fleetChauffeur,
        email: "not-an-email",
      }).success,
    ).toBe(false);
  });
});
