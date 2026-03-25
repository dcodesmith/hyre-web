import { BookingAcquisitionChannel } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { resolveBookingAcquisition } from "./booking-acquisition.server";

describe("resolveBookingAcquisition", () => {
  it("defaults to GLOBAL attribution when no input is provided", () => {
    expect(resolveBookingAcquisition()).toEqual({
      acquisitionChannel: BookingAcquisitionChannel.GLOBAL,
      acquisitionPartnerOwnerId: null,
      acquisitionPartnerSlug: null,
    });
  });

  it("normalizes non-partner attribution to GLOBAL with null partner fields", () => {
    expect(
      resolveBookingAcquisition({
        acquisitionChannel: BookingAcquisitionChannel.GLOBAL,
        acquisitionPartnerOwnerId: "owner_123",
        acquisitionPartnerSlug: "fleet-x",
      }),
    ).toEqual({
      acquisitionChannel: BookingAcquisitionChannel.GLOBAL,
      acquisitionPartnerOwnerId: null,
      acquisitionPartnerSlug: null,
    });
  });

  it("keeps partner attribution fields for PARTNER channel", () => {
    expect(
      resolveBookingAcquisition({
        acquisitionChannel: BookingAcquisitionChannel.PARTNER,
        acquisitionPartnerOwnerId: "owner_123",
        acquisitionPartnerSlug: "fleet-x",
      }),
    ).toEqual({
      acquisitionChannel: BookingAcquisitionChannel.PARTNER,
      acquisitionPartnerOwnerId: "owner_123",
      acquisitionPartnerSlug: "fleet-x",
    });
  });

  it("normalizes PARTNER attribution with missing partner fields to nulls", () => {
    expect(
      resolveBookingAcquisition({
        acquisitionChannel: BookingAcquisitionChannel.PARTNER,
      }),
    ).toEqual({
      acquisitionChannel: BookingAcquisitionChannel.PARTNER,
      acquisitionPartnerOwnerId: null,
      acquisitionPartnerSlug: null,
    });
  });

  it("treats an empty acquisition object like undefined input", () => {
    expect(resolveBookingAcquisition({})).toEqual({
      acquisitionChannel: BookingAcquisitionChannel.GLOBAL,
      acquisitionPartnerOwnerId: null,
      acquisitionPartnerSlug: null,
    });
  });
});
