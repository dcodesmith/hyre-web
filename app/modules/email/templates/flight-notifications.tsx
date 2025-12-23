import { Heading, Section, Text } from "@react-email/components";
import { render } from "@react-email/render";
import { EmailTemplate } from "./EmailTemplate";

interface FlightNotificationData {
  recipientName: string;
  recipientRole: "owner" | "driver";
  flightNumber: string;
  flightDate: string;
  originCode: string;
  destinationCode: string;
  bookingReference: string;
  carName: string;
  customerName: string;
}

interface FlightArrivalData extends FlightNotificationData {
  estimatedArrival?: string;
  actualArrival?: string;
  arrivalGate?: string;
}

interface FlightDelayData extends FlightNotificationData {
  delayMinutes: number;
  estimatedArrival: string;
  previousEstimatedArrival?: string;
}

interface FlightCancellationData {
  recipientName: string;
  recipientRole: "customer" | "owner" | "driver";
  flightNumber: string;
  originCode: string;
  destinationCode: string;
  cancellationReason?: string;
  bookingReference: string;
  carName: string;
  customerName?: string;
}

interface FlightDiversionData {
  recipientName: string;
  recipientRole: "customer" | "owner" | "driver";
  flightNumber: string;
  originCode: string;
  destinationCode: string;
  newDestinationCode: string;
  newDestinationName?: string;
  bookingReference: string;
  carName: string;
  customerName?: string;
}

interface FlightGateChangeData extends FlightNotificationData {
  oldGate?: string;
  newGate: string;
}

// --- Flight Arrival Email (Owner/Driver Only) ---
export function renderFlightArrivalEmail(data: FlightArrivalData) {
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

  return render(
    <EmailTemplate previewText={previewText} pageTitle="Flight Arrival Notification">
      <Heading as="h2" className="text-xl font-semibold mb-4">
        Flight Arrived
      </Heading>
      <Text className="mb-3">Hello {recipientName},</Text>

      <Text className="mb-3">
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

      {recipientRole === "owner" && (
        <Text className="mb-3">
          Please ensure your chauffeur is ready to pick up {customerName} at the arrivals area.
        </Text>
      )}
      {recipientRole === "driver" && (
        <Text className="mb-3">Please proceed to the arrivals area to pick up {customerName}.</Text>
      )}

      <Section className="mt-4 border-t border-gray-200 pt-4">
        <Text className="font-semibold mb-2">Flight Details</Text>
        <Text className="m-0 py-1">
          <span className="font-semibold">Flight Number:</span> {flightNumber}
        </Text>
        <Text className="m-0 py-1">
          <span className="font-semibold">Route:</span> {originCode} → {destinationCode}
        </Text>
        {arrivalTime && (
          <Text className="m-0 py-1">
            <span className="font-semibold">Arrival Time:</span> {arrivalTime}
          </Text>
        )}
        {arrivalGate && (
          <Text className="m-0 py-1">
            <span className="font-semibold">Gate:</span> {arrivalGate}
          </Text>
        )}
        <Text className="m-0 py-1">
          <span className="font-semibold">Customer:</span> {customerName}
        </Text>
        <Text className="m-0 py-1">
          <span className="font-semibold">Vehicle:</span> {carName}
        </Text>
        <Text className="m-0 py-1">
          <span className="font-semibold">Booking Reference:</span> {bookingReference}
        </Text>
      </Section>
    </EmailTemplate>,
  );
}

// --- Flight Delay Email (Owner/Driver Only) ---
export function renderFlightDelayEmail(data: FlightDelayData) {
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

  return render(
    <EmailTemplate previewText={previewText} pageTitle="Flight Delay Notification">
      <Heading as="h2" className="text-xl font-semibold mb-4">
        Flight Delayed
      </Heading>
      <Text className="mb-3">Hello {recipientName},</Text>

      <Text className="mb-3">
        Flight <span className="font-semibold">{flightNumber}</span> for your booking (
        {bookingReference}) has been delayed by <span className="font-semibold">{delayText}</span>.
      </Text>

      {recipientRole === "owner" && (
        <Text className="mb-3">
          Please inform your chauffeur to adjust the pickup time for {customerName}.
        </Text>
      )}
      {recipientRole === "driver" && (
        <Text className="mb-3">
          Please adjust your arrival time at the airport accordingly to pick up {customerName}.
        </Text>
      )}

      <Section className="mt-4 border-t border-gray-200 pt-4">
        <Text className="font-semibold mb-2">Updated Flight Details</Text>
        <Text className="m-0 py-1">
          <span className="font-semibold">Flight Number:</span> {flightNumber}
        </Text>
        <Text className="m-0 py-1">
          <span className="font-semibold">Route:</span> {originCode} → {destinationCode}
        </Text>
        <Text className="m-0 py-1">
          <span className="font-semibold">Delay:</span> {delayText}
        </Text>
        {previousEstimatedArrival && (
          <Text className="m-0 py-1">
            <span className="font-semibold">Previous Estimated Arrival:</span>{" "}
            {previousEstimatedArrival}
          </Text>
        )}
        <Text className="m-0 py-1">
          <span className="font-semibold">New Estimated Arrival:</span> {estimatedArrival}
        </Text>
        <Text className="m-0 py-1">
          <span className="font-semibold">Customer:</span> {customerName}
        </Text>
        <Text className="m-0 py-1">
          <span className="font-semibold">Vehicle:</span> {carName}
        </Text>
        <Text className="m-0 py-1">
          <span className="font-semibold">Booking Reference:</span> {bookingReference}
        </Text>
      </Section>
    </EmailTemplate>,
  );
}

// --- Flight Cancellation Email (Customer + Owner/Driver) ---
export function renderFlightCancellationEmail(data: FlightCancellationData) {
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

  return render(
    <EmailTemplate previewText={previewText} pageTitle="Flight Cancellation Alert">
      <Heading as="h2" className="text-xl font-semibold mb-4">
        Flight Cancelled
      </Heading>
      <Text className="mb-3">Hello {recipientName},</Text>

      {recipientRole === "customer" ? (
        <>
          <Text className="mb-3">
            We regret to inform you that your flight{" "}
            <span className="font-semibold">{flightNumber}</span> from {originCode} to{" "}
            {destinationCode} has been cancelled by the airline.
          </Text>
          {cancellationReason && (
            <Text className="mb-3">
              <span className="font-semibold">Reason:</span> {cancellationReason}
            </Text>
          )}
          <Text className="mb-3">
            Please contact the airline for rebooking options. Once you have your new flight details,
            please update your booking with us or contact our support team.
          </Text>
          <Text className="mb-3">
            Your chauffeur booking for the <span className="font-semibold">{carName}</span> remains
            active and can be modified based on your new flight arrangements.
          </Text>
        </>
      ) : (
        <>
          <Text className="mb-3">
            Flight <span className="font-semibold">{flightNumber}</span> for booking (
            {bookingReference}) has been cancelled by the airline.
          </Text>
          {cancellationReason && (
            <Text className="mb-3">
              <span className="font-semibold">Reason:</span> {cancellationReason}
            </Text>
          )}
          {recipientRole === "owner" && customerName && (
            <Text className="mb-3">
              The customer ({customerName}) has been notified and may contact you with updated
              flight details. The chauffeur booking remains active pending further instructions.
            </Text>
          )}
          {recipientRole === "driver" && customerName && (
            <Text className="mb-3">
              Please wait for further instructions from the fleet owner. The customer (
              {customerName}) may provide new flight details shortly.
            </Text>
          )}
        </>
      )}

      <Section className="mt-4 border-t border-gray-200 pt-4">
        <Text className="font-semibold mb-2">Cancelled Flight Details</Text>
        <Text className="m-0 py-1">
          <span className="font-semibold">Flight Number:</span> {flightNumber}
        </Text>
        <Text className="m-0 py-1">
          <span className="font-semibold">Route:</span> {originCode} → {destinationCode}
        </Text>
        {cancellationReason && (
          <Text className="m-0 py-1">
            <span className="font-semibold">Reason:</span> {cancellationReason}
          </Text>
        )}
        {customerName && (
          <Text className="m-0 py-1">
            <span className="font-semibold">Customer:</span> {customerName}
          </Text>
        )}
        {carName && recipientRole !== "customer" && (
          <Text className="m-0 py-1">
            <span className="font-semibold">Vehicle:</span> {carName}
          </Text>
        )}
        <Text className="m-0 py-1">
          <span className="font-semibold">Booking Reference:</span> {bookingReference}
        </Text>
      </Section>
    </EmailTemplate>,
  );
}

// --- Flight Diversion Email (Customer + Owner/Driver) ---
export function renderFlightDiversionEmail(data: FlightDiversionData) {
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

  return render(
    <EmailTemplate previewText={previewText} pageTitle="Flight Diversion Alert">
      <Heading as="h2" className="text-xl font-semibold mb-4">
        Flight Diverted
      </Heading>
      <Text className="mb-3">Hello {recipientName},</Text>

      {recipientRole === "customer" ? (
        <>
          <Text className="mb-3">
            Your flight <span className="font-semibold">{flightNumber}</span> from {originCode} to{" "}
            {destinationCode} has been diverted to{" "}
            <span className="font-semibold">
              {newDestinationName || newDestinationCode} ({newDestinationCode})
            </span>
          </Text>
          <Text className="mb-3">
            Please contact the airline for further information about reaching your original
            destination. You may need to update your chauffeur booking based on your new arrival
            arrangements.
          </Text>
          <Text className="mb-3">
            To modify your booking for the <span className="font-semibold">{carName}</span>, please
            contact our support team.
          </Text>
        </>
      ) : (
        <>
          <Text className="mb-3">
            Flight <span className="font-semibold">{flightNumber}</span> for booking (
            {bookingReference}) has been diverted to{" "}
            <span className="font-semibold">
              {newDestinationName || newDestinationCode} ({newDestinationCode})
            </span>
          </Text>
          {recipientRole === "owner" && customerName && (
            <Text className="mb-3">
              The customer ({customerName}) has been notified and may contact you with updated
              travel plans. Please wait for further instructions before proceeding with the pickup.
            </Text>
          )}
          {recipientRole === "driver" && customerName && (
            <Text className="mb-3">
              Please wait for updated instructions from the fleet owner. The customer (
              {customerName}) may need to make alternative arrangements to reach the original
              destination.
            </Text>
          )}
        </>
      )}

      <Section className="mt-4 border-t border-gray-200 pt-4">
        <Text className="font-semibold mb-2">Flight Diversion Details</Text>
        <Text className="m-0 py-1">
          <span className="font-semibold">Flight Number:</span> {flightNumber}
        </Text>
        <Text className="m-0 py-1">
          <span className="font-semibold">Original Route:</span> {originCode} → {destinationCode}
        </Text>
        <Text className="m-0 py-1">
          <span className="font-semibold">Diverted To:</span>{" "}
          {newDestinationName || newDestinationCode} ({newDestinationCode})
        </Text>
        {customerName && (
          <Text className="m-0 py-1">
            <span className="font-semibold">Customer:</span> {customerName}
          </Text>
        )}
        {carName && recipientRole !== "customer" && (
          <Text className="m-0 py-1">
            <span className="font-semibold">Vehicle:</span> {carName}
          </Text>
        )}
        <Text className="m-0 py-1">
          <span className="font-semibold">Booking Reference:</span> {bookingReference}
        </Text>
      </Section>
    </EmailTemplate>,
  );
}

// --- Flight Gate Change Email (Owner/Driver Only) ---
export function renderFlightGateChangeEmail(data: FlightGateChangeData) {
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

  return render(
    <EmailTemplate previewText={previewText} pageTitle="Flight Gate Change">
      <Heading as="h2" className="text-xl font-semibold mb-4">
        Gate Change Notification
      </Heading>
      <Text className="mb-3">Hello {recipientName},</Text>

      <Text className="mb-3">
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

      {recipientRole === "owner" && (
        <Text className="mb-3">
          Please inform your chauffeur about the gate change. The chauffeur should continue to wait
          at the arrivals area for {customerName}.
        </Text>
      )}
      {recipientRole === "driver" && (
        <Text className="mb-3">
          The customer ({customerName}) will arrive at the new gate. Please continue to wait at the
          arrivals area.
        </Text>
      )}

      <Section className="mt-4 border-t border-gray-200 pt-4">
        <Text className="font-semibold mb-2">Updated Flight Details</Text>
        <Text className="m-0 py-1">
          <span className="font-semibold">Flight Number:</span> {flightNumber}
        </Text>
        <Text className="m-0 py-1">
          <span className="font-semibold">Route:</span> {originCode} → {destinationCode}
        </Text>
        {oldGate && (
          <Text className="m-0 py-1">
            <span className="font-semibold">Previous Gate:</span> {oldGate}
          </Text>
        )}
        <Text className="m-0 py-1">
          <span className="font-semibold">New Gate:</span> {newGate}
        </Text>
        <Text className="m-0 py-1">
          <span className="font-semibold">Customer:</span> {customerName}
        </Text>
        <Text className="m-0 py-1">
          <span className="font-semibold">Vehicle:</span> {carName}
        </Text>
        <Text className="m-0 py-1">
          <span className="font-semibold">Booking Reference:</span> {bookingReference}
        </Text>
      </Section>
    </EmailTemplate>,
  );
}
