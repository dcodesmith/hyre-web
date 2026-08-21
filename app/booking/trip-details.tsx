import { Info } from "lucide-react";

import type { TripDurationResponse } from "~/api/flights/schema";
import { buildTripDetails } from "~/booking/airport-pickup";

interface TripDetailsProps {
  readonly arrivalTime: string;
  readonly duration: TripDurationResponse;
}

export function TripDetails({ arrivalTime, duration }: TripDetailsProps) {
  const details = buildTripDetails(arrivalTime, duration);

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-sm font-semibold">Trip Details</h3>
        <p className="flex items-center gap-1 text-xs font-normal text-gray-500">
          <Info className="size-3.5 shrink-0" aria-hidden="true" />
          Times are estimates
        </p>
      </div>
      <div className="transform-gpu rounded border border-neutral-200 bg-white px-4 py-4 shadow-xl inset-shadow-sm">
        <dl className="space-y-1.5 text-sm text-gray-950">
          <div className="flex justify-between gap-3">
            <dt className="text-gray-600">Flight Arrival</dt>
            <dd className="font-medium tabular-nums">{details.arrivalTime}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-gray-600">Pickup Time</dt>
            <dd className="font-medium tabular-nums">{details.pickupTime}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-gray-600">Estimated Drive</dt>
            <dd className="font-medium tabular-nums">
              {details.driveText}
              {details.isEstimate ? (
                <span className="text-xs text-gray-500"> (estimated)</span>
              ) : null}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-gray-600">Distance</dt>
            <dd className="font-medium tabular-nums">{details.distanceText}</dd>
          </div>
          <div className="flex justify-between gap-3 border-t border-gray-200 pt-1">
            <dt className="font-semibold text-gray-600">Estimated Drop-off</dt>
            <dd className="font-semibold tabular-nums">{details.dropOffTime}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
