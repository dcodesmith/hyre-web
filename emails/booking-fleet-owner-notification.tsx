import type { NormalisedBookingDetails } from "../app/lib/utils";
import { sampleBooking } from "../app/modules/email/fixtures/preview-fixtures";
import { FleetOwnerBookingNotificationEmail } from "../app/modules/email/templates/booking-notification";

export default function FleetOwnerBookingNotificationPreview({
  booking,
}: {
  readonly booking: NormalisedBookingDetails;
}) {
  return <FleetOwnerBookingNotificationEmail booking={booking} />;
}

FleetOwnerBookingNotificationPreview.PreviewProps = {
  booking: sampleBooking,
};
