import { sampleFlightDelayDriver } from "../app/modules/email/fixtures/preview-fixtures";
import type { FlightDelayData } from "../app/modules/email/templates/flight-notifications";
import { FlightDelayEmail } from "../app/modules/email/templates/flight-notifications";

export default function FlightDelayDriverPreview({ data }: { readonly data: FlightDelayData }) {
  return <FlightDelayEmail data={data} />;
}

FlightDelayDriverPreview.PreviewProps = {
  data: sampleFlightDelayDriver,
};
