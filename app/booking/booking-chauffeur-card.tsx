import { User } from "lucide-react";
import { DetailCard, DetailCardBody, DetailCardHeader } from "~/booking/booking-detail-card";
import type { BookingView } from "~/booking/booking-domain";

export function BookingChauffeurCard({ booking }: { readonly booking: BookingView }) {
  return (
    <DetailCard>
      <DetailCardHeader>
        <User className="h-5 w-5 text-blue-600" aria-hidden="true" />
        Your Chauffeur
      </DetailCardHeader>
      <DetailCardBody>
        <div className="flex items-center gap-3">
          <div className="relative flex h-12 w-12 shrink-0 overflow-hidden rounded-full">
            <div className="flex h-full w-full items-center justify-center rounded-full bg-muted">
              {booking.chauffeurInitials}
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold break-words text-slate-900">
              {booking.chauffeurName}
            </p>
            <p className="text-sm text-slate-600">Professional Chauffeur</p>
          </div>
        </div>
      </DetailCardBody>
    </DetailCard>
  );
}
