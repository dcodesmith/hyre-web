import type { NormalisedBookingDetails } from "../app/lib/utils";
import { sampleBookingStatusUpdate } from "../app/modules/email/fixtures/preview-fixtures";
import { BookingStatusUpdateEmail } from "../app/modules/email/templates/booking-notification";

export default function BookingStatusUpdatePreview({
  booking,
}: {
  readonly booking: NormalisedBookingDetails;
}) {
  return <BookingStatusUpdateEmail booking={booking} />;
}

BookingStatusUpdatePreview.PreviewProps = {
  booking: sampleBookingStatusUpdate,
};
