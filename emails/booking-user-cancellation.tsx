import type { NormalisedBookingDetails } from "../app/lib/utils";
import { sampleBookingCancelled } from "../app/modules/email/fixtures/preview-fixtures";
import { UserBookingCancellationEmail } from "../app/modules/email/templates/booking-notification";

export default function UserBookingCancellationPreview({
  booking,
}: {
  readonly booking: NormalisedBookingDetails;
}) {
  return <UserBookingCancellationEmail booking={booking} />;
}

UserBookingCancellationPreview.PreviewProps = {
  booking: sampleBookingCancelled,
};
