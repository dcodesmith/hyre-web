import type { NormalisedBookingDetails } from "../app/lib/utils";
import { sampleBooking } from "../app/modules/email/fixtures/preview-fixtures";
import { BookingConfirmationEmail } from "../app/modules/email/templates/booking-notification";

export default function BookingConfirmationEmailPreview({
  booking,
}: {
  readonly booking: NormalisedBookingDetails;
}) {
  return <BookingConfirmationEmail booking={booking} />;
}

BookingConfirmationEmailPreview.PreviewProps = {
  booking: sampleBooking,
};
