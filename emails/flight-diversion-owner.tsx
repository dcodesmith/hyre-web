import { sampleFlightDiversionOwner } from "../app/modules/email/fixtures/preview-fixtures";
import type { FlightDiversionData } from "../app/modules/email/templates/flight-notifications";
import { FlightDiversionEmail } from "../app/modules/email/templates/flight-notifications";

export default function FlightDiversionOwnerPreview({
  data,
}: {
  readonly data: FlightDiversionData;
}) {
  return <FlightDiversionEmail data={data} />;
}

FlightDiversionOwnerPreview.PreviewProps = {
  data: sampleFlightDiversionOwner,
};
