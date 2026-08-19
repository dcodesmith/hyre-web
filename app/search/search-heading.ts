import { BOOKING_TYPE_OPTIONS_MAP, type BookingType } from "~/booking/types";
import {
  type ServiceTier,
  serviceTierLabels,
  type VehicleType,
  vehicleTypeLabels,
} from "~/search/search-url";

const vehicleTypeNouns: Readonly<Record<VehicleType, { singular: string; plural: string }>> = {
  SEDAN: { singular: "sedan", plural: "sedans" },
  SUV: { singular: "SUV", plural: "SUVs" },
  VAN: { singular: "van / minibus", plural: "vans / minibuses" },
  CROSSOVER: { singular: "crossover", plural: "crossovers" },
};

export function buildResultsHeading(total: number, vehicleTypes: readonly VehicleType[]) {
  const form = total === 1 ? "singular" : "plural";

  if (vehicleTypes.length === 0) {
    return `${total} ${total === 1 ? "vehicle" : "vehicles"}`;
  }

  const nouns = vehicleTypes.map((type) => vehicleTypeNouns[type][form]);
  const conjunction = total === 1 ? " or " : " and ";
  const joined =
    nouns.length > 1 ? `${nouns.slice(0, -1).join(", ")}${conjunction}${nouns.at(-1)}` : nouns[0];

  return `${total} ${joined}`;
}

export function buildSearchSeoContext(filters: {
  readonly vehicleTypes?: readonly VehicleType[];
  readonly serviceTiers?: readonly ServiceTier[];
  readonly bookingType?: BookingType | null;
}) {
  const titleParts: string[] = [];
  let descriptionContext = "";

  const selectedVehicleType =
    filters.vehicleTypes?.length === 1 ? filters.vehicleTypes[0] : undefined;
  const selectedServiceTier =
    filters.serviceTiers?.length === 1 ? filters.serviceTiers[0] : undefined;

  if (selectedVehicleType) {
    const vehicleLabel = vehicleTypeLabels[selectedVehicleType];
    titleParts.push(vehicleLabel);
    descriptionContext += `${vehicleLabel} vehicles`;
  }

  if (selectedServiceTier) {
    const tierLabel = serviceTierLabels[selectedServiceTier];
    titleParts.push(tierLabel);
    descriptionContext += descriptionContext
      ? ` with ${tierLabel} service`
      : `${tierLabel} vehicles`;
  }

  if (filters.bookingType && filters.bookingType !== "DAY") {
    const bookingLabel = BOOKING_TYPE_OPTIONS_MAP[filters.bookingType].label;
    titleParts.push(`${bookingLabel} Service`);
  }

  return { titleParts, descriptionContext };
}
