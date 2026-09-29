import { User } from "lucide-react";
import { DetailCard, DetailCardBody, DetailCardHeader } from "~/booking/booking-detail-card";
import type { BookingView } from "~/booking/booking-domain";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";

export function BookingChauffeurCard({ booking }: { readonly booking: BookingView }) {
  return (
    <DetailCard>
      <DetailCardHeader>
        <User className="h-5 w-5 text-blue-600" aria-hidden="true" />
        Your Chauffeur
      </DetailCardHeader>
      <DetailCardBody>
        <div className="flex items-center gap-3">
          <Avatar className="size-12">
            {booking.chauffeurImage ? (
              <AvatarImage src={booking.chauffeurImage} alt={`${booking.chauffeurName} profile`} />
            ) : null}
            <AvatarFallback>{booking.chauffeurInitials}</AvatarFallback>
          </Avatar>
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
