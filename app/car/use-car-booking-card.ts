import { useId, useState } from "react";
import { useNavigate } from "react-router";

import type { PublicCarDetail } from "~/api/cars/schema";
import {
  isCompleteFlightNumber,
  nightBookingHelperText,
  normalizeFlightNumber,
} from "~/booking/airport-pickup";
import {
  calculateBookingUnits,
  hasCompleteBookingDates,
  isValidToDateSelection,
  nextToDateOnFromChange,
} from "~/booking/dates";
import { nextPickupTimeOnFromChange } from "~/booking/pickup";
import { AIRPORT_PICKUP_BOOKING_TYPE, type BookingType, NIGHT_BOOKING_TYPE } from "~/booking/types";
import { CarDomain } from "~/car/car-domain";
import { buildCurrentCarDetailSearchPath, type CarDetailUrlQuery } from "~/car/car-url";
import { formatZonedDate } from "~/time/timezone";

type QueryOverrides = {
  readonly from?: string | null;
  readonly to?: string | null;
  readonly pickupTime?: string | null;
  readonly flightNumber?: string | null;
  readonly pickupAddress?: string | null;
  readonly dropOffAddress?: string | null;
  readonly sameLocation?: boolean;
};

function pickOverride<T>(override: T | undefined, current: T) {
  if (override === undefined) {
    return current;
  }

  return override;
}

function nextCarBookingQuery(
  query: CarDetailUrlQuery,
  bookingType: BookingType,
  sameLocation: boolean,
  overrides: QueryOverrides,
): CarDetailUrlQuery {
  return {
    ...query,
    sameLocation: overrides.sameLocation ?? sameLocation,
    pickupAddress: pickOverride(overrides.pickupAddress, query.pickupAddress),
    dropOffAddress: pickOverride(overrides.dropOffAddress, query.dropOffAddress),
    search: {
      ...query.search,
      bookingType,
      from: pickOverride(overrides.from, query.search.from),
      to: pickOverride(overrides.to, query.search.to),
      pickupTime: pickOverride(overrides.pickupTime, query.search.pickupTime),
      flightNumber: pickOverride(overrides.flightNumber, query.search.flightNumber),
    },
  };
}

export function useCarBookingCard({
  car,
  pathname,
  query,
  initialFromDate,
  initialToDate,
  initialPickupTime,
  initialFlightNumber,
  searchFlight,
  resetFlight,
  calculateDuration,
  resetDuration,
}: {
  readonly car: PublicCarDetail;
  readonly pathname: string;
  readonly query: CarDetailUrlQuery;
  readonly initialFromDate: Date | undefined;
  readonly initialToDate: Date | undefined;
  readonly initialPickupTime: string | undefined;
  readonly initialFlightNumber: string;
  readonly searchFlight: (flightNumber: string, date: string) => void;
  readonly resetFlight: () => void;
  readonly calculateDuration: (destination: string) => void;
  readonly resetDuration: () => void;
}) {
  const navigate = useNavigate();
  const pickupTimeId = useId();
  const flightNumberId = useId();
  const pickupAddressId = useId();
  const dropOffAddressId = useId();
  const sameLocationId = useId();
  const fromDate = initialFromDate;
  const toDate = initialToDate;
  const pickupTime = initialPickupTime;
  const [flightDraft, setFlightDraft] = useState(() => ({
    source: initialFlightNumber,
    value: initialFlightNumber,
  }));
  const flightNumber =
    flightDraft.source === initialFlightNumber ? flightDraft.value : initialFlightNumber;
  const setFlightNumber = (value: string) => {
    setFlightDraft({ source: initialFlightNumber, value });
  };
  const [invalidatedAddresses, setInvalidatedAddresses] = useState<{
    pickup: string | null;
    dropOff: string | null;
  }>({ pickup: null, dropOff: null });
  const flightDraftIsCurrent =
    normalizeFlightNumber(flightNumber) === normalizeFlightNumber(query.search.flightNumber ?? "");
  const selectedPickupAddress =
    query.bookingType === AIRPORT_PICKUP_BOOKING_TYPE && !flightDraftIsCurrent
      ? ""
      : (query.pickupAddress ?? "");
  const selectedDropOffAddress = query.dropOffAddress ?? "";
  const pickupAddress =
    invalidatedAddresses.pickup === selectedPickupAddress ? "" : selectedPickupAddress;
  const dropOffAddress =
    invalidatedAddresses.dropOff === selectedDropOffAddress ? "" : selectedDropOffAddress;
  const sameLocation = query.sameLocation;
  const [fallbackDate] = useState(() => new Date());
  const bookingType = query.bookingType;
  const isAirportPickup = bookingType === AIRPORT_PICKUP_BOOKING_TYPE;
  const view = CarDomain(car, new Date(), bookingType);
  const hasCompleteDates = hasCompleteBookingDates(bookingType, fromDate, toDate);
  const totalUnits = calculateBookingUnits(
    fromDate ? formatZonedDate(fromDate) : null,
    toDate ? formatZonedDate(toDate) : null,
    bookingType,
  );
  const nightHelper = nightBookingHelperText(bookingType, totalUnits);
  const showDropOff = hasCompleteDates && (isAirportPickup || !sameLocation);
  const pickupIsReadOnly = isAirportPickup && pickupAddress.length > 0;

  const commitBookingFields = (overrides: QueryOverrides) => {
    navigate(
      buildCurrentCarDetailSearchPath(
        pathname,
        nextCarBookingQuery(query, bookingType, sameLocation, {
          flightNumber: flightNumber || null,
          ...overrides,
        }),
      ),
      { replace: true, preventScrollReset: true },
    );
  };

  const handleBookingTypeChange = (nextBookingType: BookingType) => {
    navigate(
      buildCurrentCarDetailSearchPath(
        pathname,
        nextCarBookingQuery(query, nextBookingType, sameLocation, {
          from: null,
          to: null,
          pickupTime: null,
          flightNumber: null,
          pickupAddress: null,
          dropOffAddress: null,
          sameLocation: nextBookingType !== AIRPORT_PICKUP_BOOKING_TYPE,
        }),
      ),
      {
        replace: true,
        preventScrollReset: true,
      },
    );
  };

  const handleFromDateChange = (date: Date | undefined) => {
    const nextTo = nextToDateOnFromChange(bookingType, date, toDate);
    const nextPickup = nextPickupTimeOnFromChange({
      bookingType,
      fromDate: date,
      currentPickupTime: pickupTime,
      fallbackDate,
    });

    const shouldLookupFlight =
      isAirportPickup && Boolean(date && isCompleteFlightNumber(flightNumber));

    commitBookingFields({
      from: date ? formatZonedDate(date) : null,
      to: nextTo ? formatZonedDate(nextTo) : null,
      pickupTime: bookingType === NIGHT_BOOKING_TYPE ? "11 PM" : (nextPickup ?? null),
      pickupAddress: isAirportPickup && !shouldLookupFlight ? null : undefined,
    });

    if (!shouldLookupFlight && isAirportPickup) {
      resetFlight();
      resetDuration();
    }
  };

  const handleToDateChange = (date: Date | undefined) => {
    if (!isValidToDateSelection(bookingType, fromDate, date)) {
      return;
    }

    commitBookingFields({ to: date ? formatZonedDate(date) : null });
  };

  const handlePickupTimeChange = (value: string | undefined) => {
    commitBookingFields({ pickupTime: value ?? null });
  };

  const handleFlightBlur = (value: string) => {
    const normalized = normalizeFlightNumber(value);
    setFlightNumber(normalized);

    if (!normalized || !fromDate || !isCompleteFlightNumber(normalized)) {
      resetFlight();
      resetDuration();
      commitBookingFields({
        flightNumber: normalized || null,
        pickupAddress: null,
      });
      return;
    }

    commitBookingFields({ flightNumber: normalized });
    searchFlight(normalized, formatZonedDate(fromDate));
  };

  const handleFlightNumberChange = (value: string) => {
    setFlightNumber(value);
    resetFlight();
    resetDuration();
  };

  const handlePickupAddressSelect = (address: string) => {
    setInvalidatedAddresses((current) => ({ ...current, pickup: null }));
    commitBookingFields({ pickupAddress: address || null });
  };

  const handleDropOffAddressSelect = (address: string) => {
    setInvalidatedAddresses((current) => ({ ...current, dropOff: null }));
    commitBookingFields({ dropOffAddress: address || null, sameLocation: false });

    if (!isAirportPickup || !address) {
      resetDuration();
      return;
    }

    calculateDuration(address);
  };

  const handlePickupAddressInput = (value: string) => {
    if (value !== selectedPickupAddress) {
      setInvalidatedAddresses((current) => ({
        ...current,
        pickup: selectedPickupAddress,
      }));
    }
  };

  const handleDropOffAddressInput = (value: string) => {
    if (value !== selectedDropOffAddress) {
      setInvalidatedAddresses((current) => ({
        ...current,
        dropOff: selectedDropOffAddress,
      }));
    }
  };

  const handleSameLocationChange = (checked: boolean) => {
    if (checked) {
      resetDuration();
      commitBookingFields({ sameLocation: true, dropOffAddress: null });
      return;
    }

    commitBookingFields({ sameLocation: false });
  };

  return {
    ids: {
      pickupTimeId,
      flightNumberId,
      pickupAddressId,
      dropOffAddressId,
      sameLocationId,
    },
    fromDate,
    toDate,
    pickupTime,
    flightNumber,
    handleFlightNumberChange,
    pickupAddress,
    dropOffAddress,
    sameLocation,
    fallbackDate,
    bookingType,
    isAirportPickup,
    view,
    hasCompleteDates,
    totalUnits,
    nightHelper,
    showDropOff,
    pickupIsReadOnly,
    handleBookingTypeChange,
    handleFromDateChange,
    handleToDateChange,
    handlePickupTimeChange,
    handleFlightBlur,
    handlePickupAddressSelect,
    handlePickupAddressInput,
    handleDropOffAddressSelect,
    handleDropOffAddressInput,
    handleSameLocationChange,
  };
}
