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
    <div className="w-full lg:pb-4 lg:border-b lg:border-gray-200">
      <h3 className="text-sm font-semibold mb-2">Trip Details</h3>
      <div className="bg-white border border-neutral-200 lg:border-none rounded shadow-xl inset-shadow-sm transform-gpu px-4 py-4 lg:bg-transparent lg:shadow-none lg:rounded-none lg:px-0 lg:py-0">
        <dl className="text-sm text-gray-950 space-y-1">
          <div className="flex justify-between">
            <dt className="text-gray-600">Flight Arrival</dt>
            <dd className="font-medium">
              {format(arrivalDateLagos, "h:mm a", { timeZone: LAGOS_TIMEZONE })}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-600">Pickup Time</dt>
            <dd className="font-medium">
              {format(pickupDateLagos, "h:mm a", { timeZone: LAGOS_TIMEZONE })}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-600">Estimated Drive</dt>
            <dd className="font-medium">
              {formatBufferedDuration(bufferedDriveMinutes)}
              {status === "fallback" && <span className="text-xs text-gray-500"> (estimated)</span>}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-600">Distance</dt>
            <dd className="font-medium">{distanceText}</dd>
          </div>
          <div className="flex justify-between pt-1 border-t border-gray-200">
            <dt className="text-gray-600 font-semibold">Estimated Drop-off</dt>
            <dd className="font-semibold">
              {format(dropOffDateLagos, "h:mm a", { timeZone: LAGOS_TIMEZONE })}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
