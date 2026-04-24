import { sampleFlightCancellationDriver } from "../app/modules/email/fixtures/preview-fixtures";
import type { FlightCancellationData } from "../app/modules/email/templates/flight-notifications";
import { FlightCancellationEmail } from "../app/modules/email/templates/flight-notifications";

export default function FlightCancellationDriverPreview({
  data,
}: {
  readonly data: FlightCancellationData;
}) {
  return <FlightCancellationEmail data={data} />;
}

FlightCancellationDriverPreview.PreviewProps = {
  data: sampleFlightCancellationDriver,
};
