import { sampleFlightCancellationOwner } from "../app/modules/email/fixtures/preview-fixtures";
import type { FlightCancellationData } from "../app/modules/email/templates/flight-notifications";
import { FlightCancellationEmail } from "../app/modules/email/templates/flight-notifications";

export default function FlightCancellationOwnerPreview({
  data,
}: {
  readonly data: FlightCancellationData;
}) {
  return <FlightCancellationEmail data={data} />;
}

FlightCancellationOwnerPreview.PreviewProps = {
  data: sampleFlightCancellationOwner,
};
