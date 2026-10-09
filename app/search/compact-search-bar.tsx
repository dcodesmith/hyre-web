import { Search } from "lucide-react";
import { useSearchParams } from "react-router";

import { BOOKING_TYPE_OPTIONS_MAP, type BookingType, DAY_BOOKING_TYPE } from "~/booking/types";
import { parseSearchUrl } from "~/search/search-url";
import { formatCompactPickerDate, parseZonedCalendarDate } from "~/time/timezone";

interface CompactSearchBarProps {
  readonly onClick?: () => void;
}

function formatDateRangeText(from: string | null, to: string | null) {
  if (!from) {
    return "Select dates";
  }

  const fromDate = parseZonedCalendarDate(from);

  if (!fromDate) {
    return "Select dates";
  }

  const toDate = to ? parseZonedCalendarDate(to) : undefined;

  if (!toDate || from === to) {
    return formatCompactPickerDate(fromDate);
  }

  const fromLabel = formatCompactPickerDate(fromDate);
  const toLabel = formatCompactPickerDate(toDate);

  if (fromLabel.slice(0, 3) === toLabel.slice(0, 3)) {
    return `${fromLabel}-${toLabel.replace(/^[A-Za-z]+\s/, "")}`;
  }

  return `${fromLabel} - ${toLabel}`;
}

export function CompactSearchBar({ onClick }: CompactSearchBarProps) {
  const [searchParams] = useSearchParams();
  const query = parseSearchUrl(searchParams);
  const bookingType: BookingType = query.bookingType ?? DAY_BOOKING_TYPE;
  const additionalInfo = query.flightNumber ?? query.pickupTime;
  const hasSelections = Boolean(
    query.from || query.bookingType || query.pickupTime || query.flightNumber,
  );

  return (
    <button
      type="button"
      onClick={onClick}
      className="font-search flex h-11 w-full items-center justify-center gap-4 rounded-lg border border-gray-200 bg-white px-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <Search className="size-4 shrink-0 text-gray-900" aria-hidden="true" />

      {hasSelections ? (
        <div className="flex min-w-0 items-center gap-2 text-sm leading-5 font-medium text-gray-900">
          <span className="truncate">{formatDateRangeText(query.from, query.to)}</span>
          <span className="text-gray-300">•</span>
          <span className="truncate">{BOOKING_TYPE_OPTIONS_MAP[bookingType].label}</span>
          {additionalInfo ? (
            <>
              <span className="text-gray-300">•</span>
              <span className="truncate text-gray-600">{additionalInfo}</span>
            </>
          ) : null}
        </div>
      ) : (
        <span className="text-sm leading-5 font-medium text-gray-900">
          When do you need a ride?
        </span>
      )}
    </button>
  );
}
