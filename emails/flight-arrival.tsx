import { sampleFlightArrival } from "../app/modules/email/fixtures/preview-fixtures";
import type { FlightArrivalData } from "../app/modules/email/templates/flight-notifications";
import { FlightArrivalEmail } from "../app/modules/email/templates/flight-notifications";

export default function FlightArrivalPreview({ data }: { readonly data: FlightArrivalData }) {
  return <FlightArrivalEmail data={data} />;
}

FlightArrivalPreview.PreviewProps = {
  data: sampleFlightArrival,
};
