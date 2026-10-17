import { MapPin } from "lucide-react";
import {
  ConnectedStops,
  DetailCard,
  DetailCardBody,
  DetailCardHeader,
  DetailCardIcon,
} from "~/booking/booking-detail-card";
import type { BookingView } from "~/booking/booking-domain";

function LocationStop({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-sm leading-5 font-medium text-gray-500">{label}</p>
      <p className="text-sm leading-6 font-medium break-words text-gray-900">{value}</p>
    </div>
  );
}

export function BookingLocationCard({ booking }: { readonly booking: BookingView }) {
  return (
    <DetailCard>
      <DetailCardHeader>
        <DetailCardIcon>
          <MapPin aria-hidden="true" />
        </DetailCardIcon>
        Location Details
      </DetailCardHeader>
      <DetailCardBody>
        <ConnectedStops
          first={<LocationStop label="Pickup location" value={booking.pickupLocation} />}
          second={<LocationStop label="Drop-off location" value={booking.returnLocation} />}
        />
      </DetailCardBody>
    </DetailCard>
  );
}
