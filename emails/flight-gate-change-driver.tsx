import { sampleFlightGateChangeDriver } from "../app/modules/email/fixtures/preview-fixtures";
import type { FlightGateChangeData } from "../app/modules/email/templates/flight-notifications";
import { FlightGateChangeEmail } from "../app/modules/email/templates/flight-notifications";

export default function FlightGateChangeDriverPreview({
  data,
}: {
  readonly data: FlightGateChangeData;
}) {
  return <FlightGateChangeEmail data={data} />;
}

FlightGateChangeDriverPreview.PreviewProps = {
  data: sampleFlightGateChangeDriver,
};
