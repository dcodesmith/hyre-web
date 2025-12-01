import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import type { BookingWithRelations, BookingLegWithRelations } from "~/types";
import { LAGOS_TIMEZONE } from "~/utils/timezone";

interface TimePointRowProps {
  readonly label: string;
  readonly timeText: string;
  readonly labelColorClassWhenStarted: string;
  readonly isLegStarted: boolean;
}

const TimePointRow = ({
  label,
  timeText,
  labelColorClassWhenStarted,
  isLegStarted,
}: TimePointRowProps) => (
  <div>
    <div className="flex items-center gap-2 mb-1">
      <span
        className={`text-sm font-medium ${
          isLegStarted ? labelColorClassWhenStarted : "text-slate-400"
        }`}
      >
        {label}
      </span>
      <Badge
        variant="outline"
        className={`text-sm font-semibold rounded-sm ${
          isLegStarted ? "" : "border-slate-200 text-slate-400"
        }`}
      >
        {timeText}
      </Badge>
    </div>
  </div>
);

interface BookingLegTimelineProps {
  readonly leg: BookingLegWithRelations;
  readonly index: number;
  readonly booking: BookingWithRelations;
}

function getStatusBadge(
  bookingStatus: string,
  isLegStarted: boolean,
  isLegCompleted: boolean,
  isLegUpcoming: boolean,
) {
  if (bookingStatus === "CANCELLED") {
    return { text: "Cancelled", styleClass: "bg-red-50 text-red-700 border-red-200" };
  }
  if (isLegStarted) {
    return { text: "Active", styleClass: "bg-blue-50 text-blue-700 border-blue-200" };
  }
  if (isLegCompleted) {
    return { text: "Completed", styleClass: "bg-green-50 text-green-700 border-green-200" };
  }
  if (isLegUpcoming) {
    return { text: "Upcoming", styleClass: "bg-slate-50 text-slate-700 border-slate-200" };
  }
  return { text: "Unknown", styleClass: "bg-slate-50 text-slate-700 border-slate-200" };
}

function getReturnTimeText(legEndTime: Date, extendedDuration: number): string {
  if (extendedDuration > 0) {
    return `${format(legEndTime, "h:mm a")} (Extended)`;
  }
  return format(legEndTime, "h:mm a");
}

function getFullDayReturnText(legEndTime: Date, extendedDuration: number): string {
  if (extendedDuration > 0) {
    return `${format(legEndTime, "h:mm a - MMM do")} (Extended)`;
  }
  return format(legEndTime, "h:mm a - MMM do");
}

function getServiceTypeText(bookingType: string): string {
  if (bookingType === "FULL_DAY") return "Standard 24-hour service";
  if (bookingType === "NIGHT") return "Standard 6-hour service";
  return "Standard 12-hour service";
}

function calculateExtendedDuration(
  extensions: Array<{ extendedDurationHours?: number | null }>,
): number {
  return extensions.reduce(
    (acc, { extendedDurationHours }) => acc + (extendedDurationHours ?? 0),
    0,
  );
}

function determineLegStatus(legStartTime: Date, legEndTime: Date, now: Date) {
  const isLegStarted = now >= legStartTime && now < legEndTime;
  const isLegCompleted = now >= legEndTime;
  const isLegUpcoming = !isLegStarted && !isLegCompleted;
  return { isLegStarted, isLegCompleted, isLegUpcoming };
}

function getPickupTimeText(bookingType: string, legStartTime: Date): string {
  return bookingType === "FULL_DAY"
    ? format(legStartTime, "h:mm a - MMM do")
    : format(legStartTime, "h:mm a");
}

function getReturnTimeTextForBooking(
  bookingType: string,
  legEndTime: Date,
  extendedDuration: number,
): string {
  return bookingType === "FULL_DAY"
    ? getFullDayReturnText(legEndTime, extendedDuration)
    : getReturnTimeText(legEndTime, extendedDuration);
}

function renderExtensionAlert(
  extendedDuration: number,
  isLegStarted: boolean,
  bookingEndDateObject: Date,
  legEndTime: Date,
) {
  return (
    <Alert
      className={`${
        isLegStarted ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-100"
      } rounded-sm`}
    >
      <AlertDescription
        className={`text-sm ${isLegStarted ? "text-amber-800" : "text-slate-600 line-through"}`}
      >
        Your drop-off time
        {isLegStarted ? " has been" : " was"} extended by {extendedDuration}{" "}
        {extendedDuration === 1 ? "hour" : "hours"} from {format(bookingEndDateObject, "p")} to{" "}
        {format(legEndTime, "p")}
      </AlertDescription>
    </Alert>
  );
}

function renderServiceTypeText(isLegStarted: boolean, bookingType: string) {
  return (
    <p className={`text-sm ${isLegStarted ? "text-slate-600" : "text-slate-400"}`}>
      {getServiceTypeText(bookingType)}
    </p>
  );
}

export function BookingLegTimeline({ leg, index, booking }: BookingLegTimelineProps) {
  const legDate = toZonedTime(new Date(leg.legDate), LAGOS_TIMEZONE);
  const legEndTime = toZonedTime(new Date(leg.legEndTime), LAGOS_TIMEZONE);
  const legStartTime = toZonedTime(new Date(leg.legStartTime), LAGOS_TIMEZONE);
  const bookingEndDateObject = toZonedTime(new Date(booking.endDate), LAGOS_TIMEZONE);
  const now = toZonedTime(new Date(), LAGOS_TIMEZONE);

  const { isLegStarted, isLegCompleted, isLegUpcoming } = determineLegStatus(
    legStartTime,
    legEndTime,
    now,
  );

  const extendedDuration = calculateExtendedDuration(leg.extensions);
  const statusBadge = getStatusBadge(booking.status, isLegStarted, isLegCompleted, isLegUpcoming);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h4
          className={`text-sm font-semibold ${isLegStarted ? "text-slate-700" : "text-slate-400"}`}
        >
          Day {index + 1} - {format(legDate, "EEEE, MMMM do, yyyy")}
        </h4>
        <Badge variant="outline" className={`text-xs rounded-sm ${statusBadge.styleClass}`}>
          {statusBadge.text}
        </Badge>
      </div>

      <div className="flex items-start gap-4">
        <div className="flex flex-col mt-1 items-center">
          <div
            className={`w-3 h-3 rounded-full ${isLegStarted ? "bg-green-500" : "bg-slate-300"}`}
          />
          <div className={`w-px h-8 ${isLegStarted ? "bg-slate-200" : "bg-slate-100"}`} />
          <div className={`w-3 h-3 rounded-full ${isLegStarted ? "bg-red-500" : "bg-slate-300"}`} />
        </div>

        <div className="flex-1 space-y-3">
          <TimePointRow
            label="Pickup"
            timeText={getPickupTimeText(booking.type, legStartTime)}
            labelColorClassWhenStarted="text-green-600"
            isLegStarted={isLegStarted}
          />
          <TimePointRow
            label="Return"
            timeText={getReturnTimeTextForBooking(booking.type, legEndTime, extendedDuration)}
            labelColorClassWhenStarted="text-red-600"
            isLegStarted={isLegStarted}
          />
        </div>
      </div>

      {extendedDuration > 0 && booking.type === "DAY"
        ? renderExtensionAlert(extendedDuration, isLegStarted, bookingEndDateObject, legEndTime)
        : renderServiceTypeText(isLegStarted, booking.type)}
      {index < booking.legs.length - 1 && <Separator />}
    </div>
  );
}
