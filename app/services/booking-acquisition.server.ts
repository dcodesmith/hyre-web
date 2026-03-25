import { BookingAcquisitionChannel } from "@prisma/client";

export type BookingAcquisitionInput = {
  acquisitionChannel?: BookingAcquisitionChannel;
  acquisitionPartnerOwnerId?: string | null;
  acquisitionPartnerSlug?: string | null;
};

export function resolveBookingAcquisition(input?: BookingAcquisitionInput) {
  const channel = input?.acquisitionChannel ?? BookingAcquisitionChannel.GLOBAL;

  if (channel !== BookingAcquisitionChannel.PARTNER) {
    return {
      acquisitionChannel: BookingAcquisitionChannel.GLOBAL,
      acquisitionPartnerOwnerId: null,
      acquisitionPartnerSlug: null,
    };
  }

  return {
    acquisitionChannel: BookingAcquisitionChannel.PARTNER,
    acquisitionPartnerOwnerId: input?.acquisitionPartnerOwnerId ?? null,
    acquisitionPartnerSlug: input?.acquisitionPartnerSlug ?? null,
  };
}
