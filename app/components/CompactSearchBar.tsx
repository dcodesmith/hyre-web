import { useSearchParams } from "react-router";
import { format } from "date-fns";
import { Search } from "lucide-react";
import { BOOKING_TYPE_OPTIONS_MAP, DAY_BOOKING_TYPE, type BookingType } from "./bookingTypes";

interface CompactSearchBarProps {
  readonly onClick: () => void;
}

/**
 * Compact sticky search bar for mobile
 * Shows current search summary and opens full-screen modal on click
 * Only visible on mobile after scrolling past hero
 */
export function CompactSearchBar({ onClick }: CompactSearchBarProps) {
  const [searchParams] = useSearchParams();

  // Get current search values
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const bookingTypeParam = searchParams.get("bookingType");
  const bookingType = (bookingTypeParam as BookingType) || DAY_BOOKING_TYPE;
  const pickupTime = searchParams.get("pickupTime");
  const flightNumber = searchParams.get("flightNumber");

  // Format date range text
  const getDateRangeText = () => {
    if (!from) return "Select dates";

    const fromDate = new Date(`${from}T00:00:00`);
    const toDate = to ? new Date(`${to}T00:00:00`) : null;

    if (!toDate || from === to) {
      return format(fromDate, "MMM d");
    }

    // Same month
    if (fromDate.getMonth() === toDate.getMonth()) {
      return `${format(fromDate, "MMM d")}-${format(toDate, "d")}`;
    }

    // Different months
    return `${format(fromDate, "MMM d")} - ${format(toDate, "MMM d")}`;
  };

  // Format booking type text
  const getBookingTypeText = () => {
    return BOOKING_TYPE_OPTIONS_MAP[bookingType]?.label || "Day";
  };

  // Format additional info (pickup time or flight number)
  const getAdditionalInfo = () => {
    if (flightNumber) return flightNumber;
    if (pickupTime) return pickupTime;
    return null;
  };

  const dateText = getDateRangeText();
  const bookingTypeText = getBookingTypeText();
  const additionalInfo = getAdditionalInfo();

  const hasSelections = from || bookingTypeParam || pickupTime || flightNumber;

  return (
    <button
      onClick={onClick}
      className="w-full bg-white border border-gray-200 rounded-full shadow-lg hover:shadow-xl transition-shadow px-4 py-3 flex items-center justify-center gap-3"
      type="button"
      aria-label="Edit search parameters"
    >
      <Search className="h-5 w-5 text-gray-500" />

      {hasSelections ? (
        <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
          <span className="truncate">{dateText}</span>
          <span className="text-gray-300">•</span>
          <span className="truncate">{bookingTypeText}</span>
          {additionalInfo && (
            <>
              <span className="text-gray-300">•</span>
              <span className="truncate text-gray-600">{additionalInfo}</span>
            </>
          )}
        </div>
      ) : (
        <span className="text-sm text-slate-900 font-semibold">Search for your ride</span>
      )}
    </button>
  );
}
