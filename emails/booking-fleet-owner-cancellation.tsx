import type { NormalisedBookingDetails } from "../app/lib/utils";
import { sampleBookingCancelled } from "../app/modules/email/fixtures/preview-fixtures";
import { FleetOwnerBookingCancellationEmail } from "../app/modules/email/templates/booking-notification";

export default function FleetOwnerBookingCancellationPreview({
  booking,
}: {
  readonly booking: NormalisedBookingDetails;
}) {
  return <FleetOwnerBookingCancellationEmail booking={booking} />;
}

FleetOwnerBookingCancellationPreview.PreviewProps = {
  booking: sampleBookingCancelled,
};
