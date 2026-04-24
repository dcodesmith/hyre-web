import { sampleFlightCancellationCustomer } from "../app/modules/email/fixtures/preview-fixtures";
import type { FlightCancellationData } from "../app/modules/email/templates/flight-notifications";
import { FlightCancellationEmail } from "../app/modules/email/templates/flight-notifications";

export default function FlightCancellationCustomerPreview({
  data,
}: {
  readonly data: FlightCancellationData;
}) {
  return <FlightCancellationEmail data={data} />;
}

FlightCancellationCustomerPreview.PreviewProps = {
  data: sampleFlightCancellationCustomer,
};
