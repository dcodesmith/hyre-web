import type { NormalisedBookingDetails } from "../app/lib/utils";
import { sampleBooking } from "../app/modules/email/fixtures/preview-fixtures";
import { ChauffeurAssignedEmail } from "../app/modules/email/templates/booking-notification";

export default function ChauffeurAssignedPreview({
  booking,
}: {
  readonly booking: NormalisedBookingDetails;
}) {
  return <ChauffeurAssignedEmail booking={booking} />;
}

ChauffeurAssignedPreview.PreviewProps = {
  booking: sampleBooking,
};
