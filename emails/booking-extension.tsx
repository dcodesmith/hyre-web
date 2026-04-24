import type { NormalisedExtensionDetails } from "../app/lib/utils";
import { sampleExtension } from "../app/modules/email/fixtures/preview-fixtures";
import { BookingExtensionConfirmationEmail } from "../app/modules/email/templates/booking-notification";

export default function BookingExtensionPreview({
  extension,
}: {
  readonly extension: NormalisedExtensionDetails;
}) {
  return <BookingExtensionConfirmationEmail extension={extension} />;
}

BookingExtensionPreview.PreviewProps = {
  extension: sampleExtension,
};
