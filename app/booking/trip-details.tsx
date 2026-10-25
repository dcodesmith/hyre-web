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
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-sm font-semibold leading-5">Trip Details</h3>
        <Info className="size-4 text-gray-400" aria-label="Times are estimates" />
      </div>
      <dl className="flex flex-col gap-2.5 rounded-lg border border-gray-200 px-3 py-4 text-sm leading-6 text-gray-900">
        <div className="flex justify-between gap-3">
          <dt>Flight Arrival</dt>
          <dd className="font-medium tabular-nums">{details.arrivalTime}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>Pickup Time</dt>
          <dd className="font-medium tabular-nums">{details.pickupTime}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>Estimated Drive</dt>
          <dd className="font-medium tabular-nums">
            {details.driveText}
            {details.isEstimate ? <span className="sr-only"> estimated</span> : null}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>Distance</dt>
          <dd className="font-medium tabular-nums">{details.distanceText}</dd>
        </div>
        <div className="flex justify-between gap-3 border-t border-gray-200 pt-2.5 font-medium">
          <dt>Estimated Drop-off</dt>
          <dd className="tabular-nums">{details.dropOffTime}</dd>
        </div>
      </dl>
    </div>
  );
}
