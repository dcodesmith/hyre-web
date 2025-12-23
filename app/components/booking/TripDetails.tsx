import { format, toZonedTime } from "date-fns-tz";
import { LAGOS_TIMEZONE } from "~/utils/timezone";

interface TripDetailsProps {
  readonly estimatedArrival: string;
  readonly durationInMinutes: number;
  readonly distanceText: string;
  readonly status: "success" | "fallback";
}

function formatBufferedDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} mins`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `${hours} hour${hours > 1 ? "s" : ""}`;
  }
  return `${hours} hour${hours > 1 ? "s" : ""} ${remainingMinutes} mins`;
}

export function TripDetails({
  estimatedArrival,
  durationInMinutes,
  distanceText,
  status,
}: TripDetailsProps) {
  const arrivalDate = new Date(estimatedArrival);
  const pickupDate = new Date(arrivalDate.getTime() + 40 * 60 * 1000);

  // Add 20% buffer to drive time for real-world conditions
  const bufferedDriveMinutes = Math.ceil(durationInMinutes * 1.2);
  const dropOffDate = new Date(pickupDate.getTime() + bufferedDriveMinutes * 60 * 1000);

  // Convert to Lagos timezone
  const arrivalDateLagos = toZonedTime(arrivalDate, LAGOS_TIMEZONE);
  const pickupDateLagos = toZonedTime(pickupDate, LAGOS_TIMEZONE);
  const dropOffDateLagos = toZonedTime(dropOffDate, LAGOS_TIMEZONE);

  return (
    <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
      <h4 className="text-sm font-semibold text-blue-900 mb-2">Trip Details</h4>
      <dl className="text-sm space-y-1">
        <div className="flex justify-between">
          <dt className="text-blue-700">Flight Arrival:</dt>
          <dd className="text-blue-900 font-medium">
            {format(arrivalDateLagos, "h:mm a", { timeZone: LAGOS_TIMEZONE })}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-blue-700">Pickup Time:</dt>
          <dd className="text-blue-900 font-medium">
            {format(pickupDateLagos, "h:mm a", { timeZone: LAGOS_TIMEZONE })}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-blue-700">Estimated Drive:</dt>
          <dd className="text-blue-900 font-medium">
            {formatBufferedDuration(bufferedDriveMinutes)}
            {status === "fallback" && <span className="text-xs text-blue-600"> (estimated)</span>}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-blue-700">Distance:</dt>
          <dd className="text-blue-900 font-medium">{distanceText}</dd>
        </div>
        <div className="flex justify-between pt-1 border-t border-blue-300">
          <dt className="text-blue-700 font-semibold">Estimated Drop-off:</dt>
          <dd className="text-blue-900 font-semibold">
            {format(dropOffDateLagos, "h:mm a", { timeZone: LAGOS_TIMEZONE })}
          </dd>
        </div>
      </dl>
      <p className="text-xs text-blue-600 mt-2 italic">
        * Times include a 20% buffer for luggage and real-world conditions
      </p>
    </div>
  );
}
