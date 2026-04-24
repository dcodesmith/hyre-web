import { sampleFlightArrivalDriver } from "../app/modules/email/fixtures/preview-fixtures";
import type { FlightArrivalData } from "../app/modules/email/templates/flight-notifications";
import { FlightArrivalEmail } from "../app/modules/email/templates/flight-notifications";

export default function FlightArrivalDriverPreview({ data }: { readonly data: FlightArrivalData }) {
  return <FlightArrivalEmail data={data} />;
}

FlightArrivalDriverPreview.PreviewProps = {
  data: sampleFlightArrivalDriver,
};
