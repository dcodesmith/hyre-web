import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const page = vi.hoisted(() => ({
  search: "",
  signedIn: true,
}));

vi.mock("react-router", () => ({
  Form: ({ children, ...props }: { children?: ReactNode }) =>
    createElement("form", props, children),
  Link: ({ children, to, ...props }: { children?: ReactNode; to?: string }) =>
    createElement("a", { ...props, href: to }, children),
  useFetcher: () => ({
    state: "idle",
    data: undefined,
    load: () => undefined,
    reset: () => undefined,
    Form: ({ children, ...props }: { children?: ReactNode }) =>
      createElement("form", props, children),
  }),
  useLocation: () => ({ pathname: "/cars/lexus--0123456789abcdef", search: page.search }),
  useNavigate: () => () => undefined,
  useNavigation: () => ({ formMethod: undefined, formAction: undefined, state: "idle" }),
  useSearchParams: () => [new URLSearchParams(page.search), () => undefined],
}));

vi.mock("~/auth/use-public-user", () => ({
  usePublicUser: () => (page.signedIn ? { email: "ada@example.com", name: "Ada" } : null),
}));

import type { PublicAddon } from "~/api/addons/schema";
import type { PublicCarDetail } from "~/api/cars/schema";
import { CarBookingCard } from "./car-booking-card";

const CHILD_SEAT = "018f47a2-7b3c-7d4e-8f90-1234567890b1";
const WIFI = "018f47a2-7b3c-7d4e-8f90-1234567890b2";
const INACTIVE = "018f47a2-7b3c-7d4e-8f90-1234567890ff";

const car = {
  id: "018f47a2-7b3c-7d4e-8f90-1234567890ab",
  publicRef: "0123456789abcdef",
  make: "Lexus",
  model: "UX",
  year: 2019,
  color: "Black",
  dayRate: 100_000,
  nightRate: 80_000,
  fullDayRate: 160_000,
  airportPickupRate: 70_000,
  hourlyRate: 12_000,
  fuelUpgradeRate: 15_000,
  passengerCapacity: 5,
  pricingIncludesFuel: true,
  vehicleType: "SUV",
  serviceTier: "LUXURY",
  images: [{ url: "https://example.com/lexus.jpg" }],
  owner: { username: "fleet-one", name: "Fleet One" },
  promotion: null,
  averageRating: 4.8,
  totalReviews: 12,
} satisfies PublicCarDetail;

function addon(id: string, name: string): PublicAddon {
  return {
    id,
    code: name.toUpperCase().replace(" ", "_"),
    name,
    description: null,
    pricingUnit: "PER_BOOKING",
    unitPrice: 5_000,
    currency: "NGN",
  };
}

function checkedAddonIds(markup: string) {
  return [...markup.matchAll(/name="addonIds" checked="" value="([^"]+)"/g)].map(
    (match) => match[1],
  );
}

function renderCard(search: string, signedIn = true) {
  page.search = search.startsWith("?") ? search : `?${search}`;
  page.signedIn = signedIn;
  return renderToStaticMarkup(
    createElement(CarBookingCard, {
      car,
      rates: { platformCustomerServiceFeeRatePercent: 10, vatRatePercent: 7.5 },
      addons: [addon(CHILD_SEAT, "Child seat"), addon(WIFI, "Wifi")],
    }),
  );
}

function creditValue(markup: string) {
  return markup.match(/name="useCredits" value="([^"]*)"/)?.[1];
}

describe("CarBookingCard resume state", () => {
  it("restores only active add-ons and a valid signed-in credit amount", () => {
    const markup = renderCard(
      `addonIds=${CHILD_SEAT}&addonIds=${INACTIVE}&addonIds=${WIFI}&useCredits=2500`,
    );

    expect(checkedAddonIds(markup)).toEqual([CHILD_SEAT, WIFI]);
    expect(markup).not.toContain(`value="${INACTIVE}"`);
    expect(creditValue(markup)).toBe("2500");
  });

  it("ignores invalid credit amounts and guest credit parameters", () => {
    expect(creditValue(renderCard("useCredits=100000000"))).toBe("0");
    expect(creditValue(renderCard("useCredits=12.345"))).toBe("0");
    expect(creditValue(renderCard("useCredits=abc"))).toBe("0");
    expect(creditValue(renderCard("useCredits=2500.50"))).toBe("2500.5");
    expect(creditValue(renderCard("useCredits=2500", false))).toBe("0");
  });
});
