import { Plane } from "lucide-react";
import {
  DetailCard,
  DetailCardBody,
  DetailCardHeader,
  OutlineBadge,
} from "~/booking/booking-detail-card";
import type { BookingFlightView } from "~/booking/booking-domain";

const FLIGHT_STATUS_CLASS = {
  SCHEDULED: "border-blue-200 bg-blue-100 text-blue-800",
  DEPARTED: "border-cyan-200 bg-cyan-100 text-cyan-800",
  EN_ROUTE: "border-green-200 bg-green-100 text-green-800",
  LANDED: "border-slate-200 bg-slate-100 text-slate-800",
  CANCELLED: "border-red-200 bg-red-100 text-red-800",
  DIVERTED: "border-orange-200 bg-orange-100 text-orange-800",
  UNKNOWN: "border-gray-200 bg-gray-100 text-gray-800",
} as const;

export function BookingFlightCard({ flight }: { readonly flight: BookingFlightView }) {
  return (
    <DetailCard>
      <DetailCardHeader>
        <Plane className="h-5 w-5 text-blue-600" aria-hidden="true" />
        Flight Information
      </DetailCardHeader>
      <DetailCardBody>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-lg font-bold break-words text-slate-900">{flight.flightNumber}</p>
              <p className="text-sm break-words text-slate-600">{flight.dateLabel}</p>
            </div>
            <OutlineBadge className={FLIGHT_STATUS_CLASS[flight.status]}>
              {flight.statusLabel}
            </OutlineBadge>
          </div>

          <hr className="h-px w-full border-0 bg-border" />

          <div className="space-y-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500 uppercase">From</p>
              <p className="text-sm font-semibold break-words text-slate-900">
                {flight.originName}
              </p>
              <p className="text-xs break-words text-slate-600">{flight.originMeta}</p>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500 uppercase">To</p>
              <p className="text-sm font-semibold break-words text-slate-900">
                {flight.destinationName}
              </p>
              <p className="text-xs break-words text-slate-600">{flight.destinationMeta}</p>
            </div>
          </div>

          <hr className="h-px w-full border-0 bg-border" />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase">Scheduled Arrival</p>
              <p className="text-sm font-semibold text-slate-900">{flight.scheduledArrivalLabel}</p>
            </div>
            {flight.estimatedArrivalLabel ? (
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase">Estimated Arrival</p>
                <p className="text-sm font-semibold text-slate-900">
                  {flight.estimatedArrivalLabel}
                </p>
              </div>
            ) : null}
            {flight.actualArrivalLabel ? (
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase">Actual Arrival</p>
                <p className="text-sm font-semibold text-slate-900">{flight.actualArrivalLabel}</p>
              </div>
            ) : null}
          </div>

          {flight.delayMinutes != null ? (
            <div className="rounded border border-orange-200 bg-orange-50 p-4">
              <p className="text-sm text-orange-800">Delayed by {flight.delayMinutes} minutes</p>
            </div>
          ) : null}

          {flight.aircraftType ? (
            <div className="border-t pt-2">
              <p className="text-xs text-slate-500">
                Aircraft: {flight.aircraftType}
                {flight.registration ? ` • ${flight.registration}` : null}
              </p>
            </div>
          ) : null}
        </div>
      </DetailCardBody>
    </DetailCard>
  );
}
