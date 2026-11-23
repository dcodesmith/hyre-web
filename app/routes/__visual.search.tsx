import { cn } from "cn";
import { useState } from "react";
import type { CarSearchResponse } from "~/api/cars/schema";
import { type BookingType, NIGHT_BOOKING_TYPE } from "~/booking/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectList,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select-aria";
import { SearchForm } from "~/search/search-form";
import { SearchPage } from "~/search/search-page";

const recentListingCreatedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

type TripArea = "LOCAL" | "INTERSTATE";

const INTERSTATE_DESTINATIONS = [
  { code: "NG-OG", label: "Ogun" },
  { code: "NG-OY", label: "Oyo" },
  { code: "NG-OS", label: "Osun" },
  { code: "NG-ON", label: "Ondo" },
  { code: "NG-KW", label: "Kwara" },
] as const;

function TripAreaPrototype({ bookingType }: { readonly bookingType: BookingType }) {
  const [requestedArea, setRequestedArea] = useState<TripArea>("INTERSTATE");
  const [destinationState, setDestinationState] = useState("");
  const isNight = bookingType === NIGHT_BOOKING_TYPE;
  const tripArea: TripArea = isNight ? "LOCAL" : requestedArea;

  return (
    <fieldset className="w-full rounded-md border border-gray-200 bg-white p-3">
      <legend className="sr-only">Trip area</legend>
      <div className="flex min-w-0 items-center gap-2">
        <div className="grid shrink-0 grid-cols-2 rounded-md bg-gray-100 p-1">
          {(
            [
              ["LOCAL", "Within Lagos"],
              ["INTERSTATE", "Interstate"],
            ] as const
          ).map(([value, label]) => {
            const isSelected = tripArea === value;
            const isDisabled = isNight && value === "INTERSTATE";

            return (
              <button
                key={value}
                type="button"
                aria-pressed={isSelected}
                disabled={isDisabled}
                onClick={() => setRequestedArea(value)}
                className={cn(
                  "h-9 rounded px-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                  isSelected
                    ? "bg-white text-gray-950 shadow-sm ring-1 ring-gray-200"
                    : "text-gray-600 hover:text-gray-950",
                  isDisabled && "cursor-not-allowed opacity-40",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex min-w-0 flex-1 justify-end">
          {isNight ? (
            <p
              className="truncate text-right text-xs text-gray-600"
              title="Night bookings are available within Lagos only."
            >
              Night bookings are available within Lagos only.
            </p>
          ) : tripArea === "INTERSTATE" ? (
            <>
              <label id="prototype-destination-state-label" className="sr-only">
                Destination state
              </label>
              <Select
                aria-labelledby="prototype-destination-state-label"
                placeholder="Select a state"
                selectedKey={destinationState || null}
                onSelectionChange={(key) => setDestinationState(String(key))}
              >
                <SelectTrigger className="font-search h-10 w-full border-gray-300 bg-white data-[size=default]:h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="font-search">
                  <SelectList>
                    {INTERSTATE_DESTINATIONS.map((state) => (
                      <SelectItem key={state.code} id={state.code}>
                        {state.label} State
                      </SelectItem>
                    ))}
                  </SelectList>
                </SelectContent>
              </Select>
            </>
          ) : (
            <p
              className="truncate text-right text-xs text-gray-500"
              title="Pickup and travel remain within Lagos State."
            >
              Pickup and travel remain within Lagos State.
            </p>
          )}
        </div>
      </div>
    </fieldset>
  );
}

function renderTripAreaPrototype(bookingType: BookingType) {
  return <TripAreaPrototype key={bookingType} bookingType={bookingType} />;
}

const fixtureResult = {
  cars: [
    {
      id: "018f47a2-7b3c-7d4e-8f90-123456789601",
      publicRef: "0123456789abc601",
      make: "Toyota",
      model: "Camry",
      year: 2023,
      color: "White",
      dayRate: 75_000,
      nightRate: 90_000,
      fullDayRate: 140_000,
      airportPickupRate: 55_000,
      passengerCapacity: 4,
      pricingIncludesFuel: true,
      vehicleType: "SEDAN",
      serviceTier: "EXECUTIVE",
      images: [{ url: "/images/hero-640.webp" }],
      createdAt: recentListingCreatedAt,
      owner: { username: "fleet-one", name: "Fleet One" },
      promotion: null,
      averageRating: 4.8,
      totalReviews: 24,
    },
    {
      id: "018f47a2-7b3c-7d4e-8f90-123456789602",
      publicRef: "0123456789abc602",
      make: "Lexus",
      model: "RX 350",
      year: 2022,
      color: "Black",
      dayRate: 120_000,
      nightRate: 150_000,
      fullDayRate: 220_000,
      airportPickupRate: 80_000,
      passengerCapacity: 5,
      pricingIncludesFuel: false,
      vehicleType: "SUV",
      serviceTier: "LUXURY",
      images: [{ url: "/images/hero-1200.webp" }],
      createdAt: recentListingCreatedAt,
      owner: { username: "fleet-two", name: "Fleet Two" },
      promotion: {
        id: "018f47a2-7b3c-7d4e-8f90-123456789501",
        name: "August offer",
        discountValue: 10,
      },
      averageRating: 4.9,
      totalReviews: 18,
    },
    {
      id: "018f47a2-7b3c-7d4e-8f90-123456789603",
      publicRef: "0123456789abc603",
      make: "Toyota",
      model: "Highlander",
      year: 2021,
      color: "Silver",
      dayRate: 95_000,
      nightRate: 110_000,
      fullDayRate: 180_000,
      airportPickupRate: 70_000,
      passengerCapacity: 6,
      pricingIncludesFuel: true,
      vehicleType: "SUV",
      serviceTier: "STANDARD",
      images: [{ url: "/images/hero.webp" }],
      createdAt: "2026-01-01T09:00:00.000Z",
      owner: { username: null, name: "Fleet Three" },
      promotion: null,
      averageRating: 0,
      totalReviews: 0,
    },
  ],
  filters: {
    serviceTiers: [],
    vehicleTypes: [],
    bookingType: "DAY",
  },
  facets: {
    makes: [
      { name: "Toyota", count: 2 },
      { name: "Lexus", count: 1 },
    ],
    price: { min: 55_000, max: 220_000 },
  },
  pagination: {
    page: 1,
    limit: 12,
    total: 3,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  },
} satisfies CarSearchResponse;

export default function SearchFixture() {
  return (
    <>
      <section className="bg-gray-950 px-4 pt-24 pb-8 md:pt-8">
        <div className="mx-auto max-w-xl">
          <div className="mb-4 text-white">
            <p className="text-xs font-semibold tracking-wide text-orange-300 uppercase">
              Interstate placement prototype
            </p>
            <h1 className="mt-1 text-xl font-semibold">Search before choosing a vehicle</h1>
            <p className="mt-1 text-sm text-gray-300">
              Shown with Interstate selected; the production default remains Within Lagos.
            </p>
          </div>
          <SearchForm renderTripArea={renderTripAreaPrototype} />
        </div>
      </section>
      <SearchPage result={fixtureResult} />
    </>
  );
}
