import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const router = {
  searchParams: new URLSearchParams(),
  pathname: "/",
  navigate: vi.fn(),
};

vi.mock("react-router", () => ({
  Form: ({ children, ...props }: { children?: ReactNode }) =>
    createElement("form", props, children),
  useSearchParams: () => [router.searchParams],
  useLocation: () => ({ pathname: router.pathname }),
  useNavigate: () => router.navigate,
  useNavigation: () => ({ state: "idle", location: undefined }),
}));

vi.mock("~/hooks/use-airport-pickup", () => ({
  useAirportPickup: () => ({
    flight: null,
    flightError: null,
    searchFlight: vi.fn(),
    resetFlight: vi.fn(),
  }),
}));

vi.mock("~/booking/booking-time-select", () => ({
  BookingTimeSelect: ({ label }: { label?: string }) =>
    createElement("div", { "data-mock": "pickup-time" }, label ?? "Pickup"),
}));

vi.mock("~/components/ui/popover", () => ({
  Popover: ({ children }: { children?: ReactNode }) => createElement("div", null, children),
  PopoverTrigger: ({ asChild, children }: { asChild?: boolean; children?: ReactNode }) =>
    asChild && children ? children : createElement("button", { type: "button" }, children),
  PopoverContent: ({ children }: { children?: ReactNode }) => createElement("div", null, children),
}));

vi.mock("~/components/ui/calendar", () => ({
  Calendar: () => createElement("div", { "data-calendar": "stub" }),
}));

vi.mock("~/booking/flight-number-autocomplete", () => ({
  FlightNumberAutocomplete: ({ id, value }: { id?: string; value?: string }) =>
    createElement("input", { id, type: "text", readOnly: true, value: value ?? "" }),
}));

import { SearchForm } from "~/search/search-form";

describe("SearchForm", () => {
  it("serializes booking params into hidden fields for a standard day search", () => {
    router.searchParams = new URLSearchParams(
      "bookingType=DAY&from=2026-08-20&to=2026-08-21&pickupTime=9%20AM",
    );
    router.pathname = "/";

    const markup = renderToStaticMarkup(createElement(SearchForm, { isCompact: false }));

    expect(markup).toContain('name="bookingType"');
    expect(markup).toContain('value="DAY"');
    expect(markup).toContain('name="from"');
    expect(markup).toContain('value="2026-08-20"');
    expect(markup).toContain('name="to"');
    expect(markup).toContain('value="2026-08-21"');
    expect(markup).toContain("When");
  });

  it("adds night pickup time and airport flight hidden fields", () => {
    router.searchParams = new URLSearchParams("bookingType=NIGHT&from=2026-08-20");
    router.pathname = "/";
    const nightMarkup = renderToStaticMarkup(createElement(SearchForm, { isCompact: false }));
    expect(nightMarkup).toContain('name="pickupTime"');
    expect(nightMarkup).toContain('value="11 PM"');

    router.searchParams = new URLSearchParams(
      "bookingType=AIRPORT_PICKUP&from=2026-08-20&flightNumber=BA123",
    );
    const airportMarkup = renderToStaticMarkup(createElement(SearchForm, { isCompact: true }));
    expect(airportMarkup).toContain('name="flightNumber"');
    expect(airportMarkup).toContain('value="BA123"');
    expect(airportMarkup).toContain("When");
  });

  it("preserves active filter params as hidden inputs on the search page", () => {
    router.searchParams = new URLSearchParams(
      "bookingType=DAY&from=2026-08-20&vehicleType=SUV&dealsOnly=1",
    );
    router.pathname = "/search";

    const markup = renderToStaticMarkup(
      createElement(SearchForm, { isCompact: false, preserveFilterParams: true }),
    );

    expect(markup).toContain('name="vehicleType"');
    expect(markup).toContain('value="SUV"');
    expect(markup).toContain('name="dealsOnly"');
    expect(markup).toContain('value="1"');
  });
});
