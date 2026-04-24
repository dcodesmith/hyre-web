import { sampleFlightGateChange } from "../app/modules/email/fixtures/preview-fixtures";
import type { FlightGateChangeData } from "../app/modules/email/templates/flight-notifications";
import { FlightGateChangeEmail } from "../app/modules/email/templates/flight-notifications";

export default function FlightGateChangePreview({ data }: { readonly data: FlightGateChangeData }) {
  return <FlightGateChangeEmail data={data} />;
}

FlightGateChangePreview.PreviewProps = {
  data: sampleFlightGateChange,
};
