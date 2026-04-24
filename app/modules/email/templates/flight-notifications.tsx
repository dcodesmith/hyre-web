import { Heading, Hr, Section, Text, render } from "react-email";
import { EmailTemplate } from "./EmailTemplate";

export interface FlightNotificationData {
  readonly recipientName: string;
  readonly recipientRole: "owner" | "driver";
  readonly flightNumber: string;
  readonly flightDate: string;
  readonly originCode: string;
  readonly destinationCode: string;
  readonly bookingReference: string;
  readonly carName: string;
  readonly customerName: string;
}

export interface FlightArrivalData extends FlightNotificationData {
  readonly estimatedArrival?: string;
  readonly actualArrival?: string;
  readonly arrivalGate?: string;
}

export interface FlightDelayData extends FlightNotificationData {
  readonly delayMinutes: number;
  readonly estimatedArrival: string;
  readonly previousEstimatedArrival?: string;
}

export interface FlightCancellationData {
  readonly recipientName: string;
  readonly recipientRole: "customer" | "owner" | "driver";
  readonly flightNumber: string;
  readonly originCode: string;
  readonly destinationCode: string;
  readonly cancellationReason?: string;
  readonly bookingReference: string;
  readonly carName: string;
  readonly customerName?: string;
}

export interface FlightDiversionData {
  readonly recipientName: string;
  readonly recipientRole: "customer" | "owner" | "driver";
  readonly flightNumber: string;
  readonly originCode: string;
  readonly destinationCode: string;
  readonly newDestinationCode: string;
  readonly newDestinationName?: string;
  readonly bookingReference: string;
  readonly carName: string;
  readonly customerName?: string;
}

export interface FlightGateChangeData extends FlightNotificationData {
  readonly oldGate?: string;
  readonly newGate: string;
}

type FlightDetailRow = {
  readonly label: string;
  readonly value?: string;
};

function FlightDetailCard({
  label,
  value,
  subline,
  rows,
  guidance,
}: {
  readonly label: string;
  readonly value: string;
  readonly subline: string;
  readonly rows: readonly FlightDetailRow[];
  readonly guidance?: string;
}) {
  const visibleRows = rows.filter((row) => Boolean(row.value));

  return (
    <Section className="mt-6 border border-solid border-[#E6E6E8] rounded-[14px] overflow-hidden">
      <Section className="px-5 py-4">
        <Text className="text-[11px] font-semibold tracking-[0.1em] uppercase text-[#6A6A71] m-0">
          {label}
        </Text>
        <Text className="text-[18px] leading-[24px] font-bold text-[#0B0B0F] m-0 mt-1">
          {value}
        </Text>
        <Text className="text-[13px] leading-[18px] text-[#6A6A71] m-0 mt-1">{subline}</Text>
      </Section>

      <Hr className="m-0 border-t border-solid border-[#EFEFF1]" />

      <Section className="px-5 py-4">
        <table width="100%" cellPadding={0} cellSpacing={0} role="presentation">
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.label}>
                <td className="py-1 pr-2 align-top">
                  <Text className="m-0 text-[12px] leading-[18px] text-[#6A6A71]">{row.label}</Text>
                </td>
                <td align="right" className="py-1 align-top">
                  <Text className="m-0 text-[13px] leading-[18px] font-semibold text-[#0B0B0F]">
                    {row.value}
                  </Text>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {guidance && (
        <>
          <Hr className="m-0 border-t border-solid border-[#EFEFF1]" />
          <Section className="px-5 py-4 bg-[#FAFAFB]">
            <Text className="m-0 text-[13px] leading-[18px] text-[#4A4A52]">{guidance}</Text>
          </Section>
        </>
      )}
    </Section>
  );
}

// --- Flight Arrival Email (Owner/Driver Only) ---
export function FlightArrivalEmail({ data }: { readonly data: FlightArrivalData }) {
  const {
    recipientName,
    recipientRole,
    flightNumber,
    originCode,
    destinationCode,
    estimatedArrival,
    actualArrival,
    arrivalGate,
    bookingReference,
    carName,
    customerName,
  } = data;

  const previewText = `Flight ${flightNumber} has arrived`;
  const arrivalTime = actualArrival || estimatedArrival;
  const firstName = recipientName.split(" ")[0] || recipientName;
  const roleGuidance =
    recipientRole === "owner"
      ? `Please ensure your chauffeur is ready to pick up ${customerName} at the arrivals area.`
      : `Please proceed to the arrivals area to pick up ${customerName}.`;

  return (
    <EmailTemplate previewText={previewText} pageTitle="Flight Arrival Notification">
      <Text className="text-[12px] font-semibold tracking-[0.08em] uppercase text-[#6A6A71] m-0 mb-2">
        Flight update
      </Text>
      <Heading as="h1" className="text-[26px] leading-[32px] font-extrabold text-[#0B0B0F] m-0">
        Flight arrived, {firstName}.
      </Heading>
      <Text className="text-[15px] leading-[22px] text-[#4A4A52] mt-3 mb-0">
        Flight <span className="font-semibold">{flightNumber}</span> for your booking (
        {bookingReference}) has arrived
        {arrivalGate && (
          <>
            {" "}
            at gate <span className="font-semibold">{arrivalGate}</span>
          </>
        )}
        .
      </Text>

      <FlightDetailCard
        label="Arrival details"
        value={`Flight ${flightNumber}`}
        subline={`${originCode} -> ${destinationCode}`}
        guidance={roleGuidance}
        rows={[
          { label: "Arrival time", value: arrivalTime },
          { label: "Gate", value: arrivalGate },
          { label: "Customer", value: customerName },
          { label: "Vehicle", value: carName },
          { label: "Booking reference", value: bookingReference },
        ]}
      />
    </EmailTemplate>
  );
}

export function renderFlightArrivalEmail(data: FlightArrivalData) {
  return render(<FlightArrivalEmail data={data} />);
}

// --- Flight Delay Email (Owner/Driver Only) ---
export function FlightDelayEmail({ data }: { readonly data: FlightDelayData }) {
  const {
    recipientName,
    recipientRole,
    flightNumber,
    originCode,
    destinationCode,
    delayMinutes,
    estimatedArrival,
    previousEstimatedArrival,
    bookingReference,
    carName,
    customerName,
  } = data;

  const previewText = `Flight ${flightNumber} is delayed by ${delayMinutes} minutes`;
  const delayHours = Math.floor(delayMinutes / 60);
  const delayMins = delayMinutes % 60;

  const formatDelayText = () => {
    if (delayHours === 0) {
      return `${delayMins} minutes`;
    }
    const hourText = `${delayHours} hour${delayHours > 1 ? "s" : ""}`;
    const minText = delayMins > 0 ? ` ${delayMins} minutes` : "";
    return `${hourText}${minText}`;
  };

  const delayText = formatDelayText();
  const firstName = recipientName.split(" ")[0] || recipientName;
  const roleGuidance =
    recipientRole === "owner"
      ? `Please inform your chauffeur to adjust the pickup time for ${customerName}.`
      : `Please adjust your arrival time at the airport accordingly to pick up ${customerName}.`;

  return (
    <EmailTemplate previewText={previewText} pageTitle="Flight Delay Notification">
      <Text className="text-[12px] font-semibold tracking-[0.08em] uppercase text-[#6A6A71] m-0 mb-2">
        Flight update
      </Text>
      <Heading as="h1" className="text-[26px] leading-[32px] font-extrabold text-[#0B0B0F] m-0">
        Delay alert, {firstName}.
      </Heading>
      <Text className="text-[15px] leading-[22px] text-[#4A4A52] mt-3 mb-0">
        Flight <span className="font-semibold">{flightNumber}</span> for your booking (
        {bookingReference}) has been delayed by <span className="font-semibold">{delayText}</span>.
      </Text>

      <FlightDetailCard
        label="Delay details"
        value={`Flight ${flightNumber}`}
        subline={`${originCode} -> ${destinationCode}`}
        guidance={roleGuidance}
        rows={[
          { label: "Delay", value: delayText },
          { label: "Previous ETA", value: previousEstimatedArrival },
          { label: "New ETA", value: estimatedArrival },
          { label: "Customer", value: customerName },
          { label: "Vehicle", value: carName },
          { label: "Booking reference", value: bookingReference },
        ]}
      />
    </EmailTemplate>
  );
}

export function renderFlightDelayEmail(data: FlightDelayData) {
  return render(<FlightDelayEmail data={data} />);
}

// --- Flight Cancellation Email (Customer + Owner/Driver) ---
export function FlightCancellationEmail({ data }: { readonly data: FlightCancellationData }) {
  const {
    recipientName,
    recipientRole,
    flightNumber,
    originCode,
    destinationCode,
    cancellationReason,
    bookingReference,
    carName,
    customerName,
  } = data;

  const previewText = `Flight ${flightNumber} has been cancelled`;
  const isCustomerRecipient = recipientRole === "customer";
  const firstName = recipientName.split(" ")[0] || recipientName;
  const customerGuidance =
    "Please contact the airline for rebooking options, then update your chauffeur booking with us.";
  const opsGuidance =
    recipientRole === "owner"
      ? `The customer (${customerName}) has been notified and may share updated flight details.`
      : `Please wait for further instructions from the fleet owner regarding ${customerName}.`;

  return (
    <EmailTemplate previewText={previewText} pageTitle="Flight Cancellation Alert">
      <Text className="text-[12px] font-semibold tracking-[0.08em] uppercase text-[#6A6A71] m-0 mb-2">
        Flight cancelled
      </Text>
      <Heading as="h1" className="text-[26px] leading-[32px] font-extrabold text-[#0B0B0F] m-0">
        Cancellation alert, {firstName}.
      </Heading>
      <Text className="text-[15px] leading-[22px] text-[#4A4A52] mt-3 mb-0">
        Flight <span className="font-semibold">{flightNumber}</span> from {originCode} to{" "}
        {destinationCode} has been cancelled by the airline.
      </Text>

      <FlightDetailCard
        label="Cancelled flight"
        value={`Flight ${flightNumber}`}
        subline={`${originCode} -> ${destinationCode}`}
        guidance={isCustomerRecipient ? customerGuidance : opsGuidance}
        rows={[
          { label: "Reason", value: cancellationReason },
          { label: "Customer", value: customerName },
          { label: "Vehicle", value: isCustomerRecipient ? undefined : carName },
          { label: "Booking reference", value: bookingReference },
        ]}
      />
    </EmailTemplate>
  );
}

export function renderFlightCancellationEmail(data: FlightCancellationData) {
  return render(<FlightCancellationEmail data={data} />);
}

// --- Flight Diversion Email (Customer + Owner/Driver) ---
export function FlightDiversionEmail({ data }: { readonly data: FlightDiversionData }) {
  const {
    recipientName,
    recipientRole,
    flightNumber,
    originCode,
    destinationCode,
    newDestinationCode,
    newDestinationName,
    bookingReference,
    carName,
    customerName,
  } = data;

  const previewText = `Flight ${flightNumber} has been diverted`;
  const isCustomerRecipient = recipientRole === "customer";
  const firstName = recipientName.split(" ")[0] || recipientName;
  const hasDistinctDestinationName =
    Boolean(newDestinationName) &&
    newDestinationName?.trim().toUpperCase() !== newDestinationCode.toUpperCase();
  const divertedTo = hasDistinctDestinationName
    ? `${newDestinationName} (${newDestinationCode})`
    : newDestinationCode;
  const customerGuidance =
    "Please contact the airline for onward travel details, then update your chauffeur booking as needed.";
  const opsGuidance =
    recipientRole === "owner"
      ? `The customer (${customerName}) may contact you with updated travel plans.`
      : `Wait for updated instructions from the fleet owner regarding ${customerName}.`;

  return (
    <EmailTemplate previewText={previewText} pageTitle="Flight Diversion Alert">
      <Text className="text-[12px] font-semibold tracking-[0.08em] uppercase text-[#6A6A71] m-0 mb-2">
        Flight diverted
      </Text>
      <Heading as="h1" className="text-[26px] leading-[32px] font-extrabold text-[#0B0B0F] m-0">
        Diversion alert, {firstName}.
      </Heading>
      <Text className="text-[15px] leading-[22px] text-[#4A4A52] mt-3 mb-0">
        Flight <span className="font-semibold">{flightNumber}</span> has been diverted to{" "}
        <span className="font-semibold">{divertedTo}</span>.
      </Text>

      <FlightDetailCard
        label="Diversion details"
        value={`Flight ${flightNumber}`}
        subline={`${originCode} -> ${destinationCode}`}
        guidance={isCustomerRecipient ? customerGuidance : opsGuidance}
        rows={[
          { label: "Diverted to", value: divertedTo },
          { label: "Customer", value: customerName },
          { label: "Vehicle", value: isCustomerRecipient ? undefined : carName },
          { label: "Booking reference", value: bookingReference },
        ]}
      />
    </EmailTemplate>
  );
}

export function renderFlightDiversionEmail(data: FlightDiversionData) {
  return render(<FlightDiversionEmail data={data} />);
}

// --- Flight Gate Change Email (Owner/Driver Only) ---
export function FlightGateChangeEmail({ data }: { readonly data: FlightGateChangeData }) {
  const {
    recipientName,
    recipientRole,
    flightNumber,
    originCode,
    destinationCode,
    oldGate,
    newGate,
    bookingReference,
    carName,
    customerName,
  } = data;

  const previewText = `Gate changed for flight ${flightNumber}`;
  const firstName = recipientName.split(" ")[0] || recipientName;
  const roleGuidance =
    recipientRole === "owner"
      ? `Please inform your chauffeur about the gate change for ${customerName}.`
      : `The customer (${customerName}) will arrive at the new gate.`;

  return (
    <EmailTemplate previewText={previewText} pageTitle="Flight Gate Change">
      <Text className="text-[12px] font-semibold tracking-[0.08em] uppercase text-[#6A6A71] m-0 mb-2">
        Gate change
      </Text>
      <Heading as="h1" className="text-[26px] leading-[32px] font-extrabold text-[#0B0B0F] m-0">
        Gate updated, {firstName}.
      </Heading>
      <Text className="text-[15px] leading-[22px] text-[#4A4A52] mt-3 mb-0">
        The arrival gate for flight <span className="font-semibold">{flightNumber}</span> (
        {bookingReference}) has changed
        {oldGate && (
          <>
            {" "}
            from gate <span className="font-semibold">{oldGate}</span>
          </>
        )}{" "}
        to gate <span className="font-semibold">{newGate}</span>.
      </Text>

      <FlightDetailCard
        label="Gate details"
        value={`Flight ${flightNumber}`}
        subline={`${originCode} -> ${destinationCode}`}
        guidance={roleGuidance}
        rows={[
          { label: "Previous gate", value: oldGate },
          { label: "New gate", value: newGate },
          { label: "Customer", value: customerName },
          { label: "Vehicle", value: carName },
          { label: "Booking reference", value: bookingReference },
        ]}
      />
    </EmailTemplate>
  );
}

export function renderFlightGateChangeEmail(data: FlightGateChangeData) {
  return render(<FlightGateChangeEmail data={data} />);
}
