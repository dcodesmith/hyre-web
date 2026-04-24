import { sampleFlightDiversionCustomer } from "../app/modules/email/fixtures/preview-fixtures";
import type { FlightDiversionData } from "../app/modules/email/templates/flight-notifications";
import { FlightDiversionEmail } from "../app/modules/email/templates/flight-notifications";

export default function FlightDiversionCustomerPreview({
  data,
}: {
  readonly data: FlightDiversionData;
}) {
  return <FlightDiversionEmail data={data} />;
}

FlightDiversionCustomerPreview.PreviewProps = {
  data: sampleFlightDiversionCustomer,
};
