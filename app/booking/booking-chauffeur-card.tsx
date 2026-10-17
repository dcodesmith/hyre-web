import { User } from "lucide-react";
import {
  DetailCard,
  DetailCardBody,
  DetailCardHeader,
  DetailCardIcon,
} from "~/booking/booking-detail-card";
import type { BookingView } from "~/booking/booking-domain";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";

export function BookingChauffeurCard({ booking }: { readonly booking: BookingView }) {
  return (
    <DetailCard>
      <DetailCardHeader>
        <DetailCardIcon>
          <User aria-hidden="true" />
        </DetailCardIcon>
        Chauffeur
      </DetailCardHeader>
      <DetailCardBody>
        <div className="flex items-center gap-3">
          <Avatar className="size-[50px]">
            {booking.chauffeurImage ? (
              <AvatarImage src={booking.chauffeurImage} alt={`${booking.chauffeurName} profile`} />
            ) : null}
            <AvatarFallback>{booking.chauffeurInitials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm leading-6 font-medium break-words text-gray-900">
              {booking.chauffeurName}
            </p>
            <p className="text-sm leading-5 font-medium text-gray-500">Professional Chauffeur</p>
          </div>
        </div>
      </DetailCardBody>
    </DetailCard>
  );
}
