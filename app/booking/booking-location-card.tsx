import { MapPin } from "lucide-react";
import { DetailCard, DetailCardBody, DetailCardHeader } from "~/booking/booking-detail-card";
import type { BookingView } from "~/booking/booking-domain";

export function BookingLocationCard({ booking }: { readonly booking: BookingView }) {
  return (
    <DetailCard>
      <DetailCardHeader>
        <MapPin className="h-5 w-5 text-blue-600" aria-hidden="true" />
        Location Details
      </DetailCardHeader>
      <DetailCardBody>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-green-500" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-600">Pickup Location</p>
              <p className="text-sm font-semibold break-words text-slate-900">
                {booking.pickupLocation}
              </p>
            </div>
          </div>
          <hr className="h-px w-full border-0 bg-border" />
          <div className="flex items-start gap-3">
            <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-red-500" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-600">Return Location</p>
              <p className="text-sm font-semibold break-words text-slate-900">
                {booking.returnLocation}
              </p>
            </div>
          </div>
        </div>
      </DetailCardBody>
    </DetailCard>
  );
}
