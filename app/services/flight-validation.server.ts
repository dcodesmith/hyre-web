import { differenceInDays } from "date-fns";
import logger from "~/lib/logger.server";
import { env } from "~/utils/server/env.server";

/**
 * FlightAware API Types
 */

// Real-time flights endpoint response (for flights < 2 days out)
interface FlightAwareFlightLeg {
  ident: string;
  fa_flight_id: string;
  actual_off?: string;
  actual_on?: string;
  estimated_off?: string;
  estimated_on?: string;
  estimated_in?: string;
  scheduled_off: string;
  scheduled_on: string;
  origin: {
    code: string;
    code_iata?: string;
    name?: string;
  } | null;
  destination: {
    code: string;
    code_iata?: string;
    name?: string;
    city?: string;
  } | null;
  aircraft_type?: string;
  status?: string;
  delay?: number;
}

interface FlightAwareResponse {
  flights: FlightAwareFlightLeg[];
  num_pages?: number;
}

// Schedules endpoint response (for flights > 2 days out)
interface FlightAwareScheduledFlight {
  ident: string; // Primary identifier (usually ICAO)
  ident_iata?: string | null; // IATA identifier (e.g., "BA75")
  ident_icao?: string | null; // ICAO identifier (e.g., "BAW75")
  actual_ident?: string | null; // Operating flight ICAO ident when codeshare
  actual_ident_iata?: string | null; // Operating flight IATA ident when codeshare
  actual_ident_icao?: string | null; // Operating flight ICAO ident when codeshare
  fa_flight_id?: string | null;
  operator?: string | null;
  operator_iata?: string | null;
  operator_icao?: string | null;
  flight_number?: string | null;
  origin: string; // ICAO code (e.g., "EGLL")
  origin_iata?: string | null;
  origin_icao?: string | null;
  origin_lid?: string | null;
  destination: string; // ICAO code (e.g., "KJFK")
  destination_iata?: string | null;
  destination_icao?: string | null;
  destination_lid?: string | null;
  scheduled_out: string; // Scheduled departure time (ISO)
  scheduled_in: string; // Scheduled arrival time (ISO)
  scheduled_off?: string | null;
  scheduled_on?: string | null;
  estimated_in?: string | null;
  actual_out?: string | null;
  actual_in?: string | null;
  meal_service?: string | null;
  seats_cabin_business?: number | null;
  seats_cabin_coach?: number | null;
  seats_cabin_first?: number | null;
  aircraft_type?: string | null;
}

interface FlightAwareSchedulesResponse {
  scheduled: FlightAwareScheduledFlight[];
  num_pages?: number;
  links?: string | null;
}

interface FlightAwareAirportFlightsResponse {
  arrivals?: unknown[];
  scheduled_arrivals?: unknown[];
}

export interface ValidatedFlight {
  flightNumber: string;
  flightId: string;
  origin: string;
  originIATA?: string;
  destination: string;
  destinationIATA?: string;
  scheduledArrival: string;
  estimatedArrival?: string;
  actualArrival?: string;
  status?: string;
  aircraftType?: string;
  delay?: number;
  arrivalAddress?: string;
  isLive?: boolean; // True if from real-time API, false if from schedules
}

/**
 * Result type for flight validation
 * Represents different outcomes of flight validation
 */
export type FlightValidationResult =
  | {
      type: "success";
      flight: ValidatedFlight;
    }
  | {
      type: "alreadyLanded";
      flightNumber: string;
      requestedDate: string;
      landedTime: string; // Time the flight landed (for display)
      nextFlightDate?: string;
    }
  | {
      type: "notFound";
    }
  | {
      type: "error";
      message: string;
    };

/**
 * IATA to ICAO airline code mapping
 * Format: { IATA: ICAO }
 */
const IATA_TO_ICAO_MAP: Record<string, string> = {
  BA: "BAW", // British Airways
  VS: "VIR", // Virgin Atlantic
  AF: "AFR", // Air France
  KL: "KLM", // KLM Royal Dutch Airlines
  LH: "DLH", // Lufthansa
  QR: "QTR", // Qatar Airways
  EK: "UAE", // Emirates
  TK: "THY", // Turkish Airlines
  ET: "ETH", // Ethiopian Airlines
  KQ: "KQA", // Kenya Airways
  MS: "MSR", // EgyptAir
  SV: "SVA", // Saudi Arabian Airlines
  DL: "DAL", // Delta Air Lines
  UA: "UAL", // United Airlines
  AT: "RAM", // Royal Air Maroc
  SA: "SAA", // South African Airways
  RW: "WB", // RwandAir
  Q9: "GWG", // Green Africa Airways
  P4: "APK", // Air Peace
  W3: "ARA", // Arik Air
};

/**
 * Convert IATA flight number to ICAO flight number
 * Example: VS411 → VIR411, BA75 → BAW75, P47579 → APK7579
 */
function convertIATAToICAO(flightNumber: string): string | null {
  // Extract airline code and flight number using regex patterns
  // Allow alphanumeric codes (e.g., "P4" for Air Peace)
  // Try 2-character codes first (IATA), then 3-character (ICAO)
  // This correctly handles "P47579" -> "P4" + "7579" (not "P47" + "579")

  // Pattern: ^([A-Z0-9]{2})(\d{1,5})$
  // Matches: 2 alphanumeric chars (airline code) + 1-5 digits (flight number)
  // Examples: P47579, BA75, 3K123
  const match2 = /^([A-Z0-9]{2})(\d{1,5})$/i.exec(flightNumber);

  // Pattern: ^([A-Z0-9]{3})(\d{1,5})$
  // Matches: 3 alphanumeric chars (airline code) + 1-5 digits (flight number)
  // Examples: APK7579, BAW75, VIR411
  const match3 = /^([A-Z0-9]{3})(\d{1,5})$/i.exec(flightNumber);

  let airlineCode: string | null = null;
  let flightNum: string | null = null;

  // Prefer 2-character codes (IATA) if they match, otherwise try 3-character (ICAO)
  if (match2?.[1]) {
    airlineCode = match2[1].toUpperCase();
    flightNum = match2[2];
  } else if (match3?.[1]) {
    airlineCode = match3[1].toUpperCase();
    flightNum = match3[2];
  }

  if (!airlineCode || !flightNum) return null;

  const icaoCode = IATA_TO_ICAO_MAP[airlineCode];

  if (!icaoCode) {
    return null;
  }

  const icaoFlightNumber = `${icaoCode}${flightNum}`;
  return icaoFlightNumber;
}

/**
 * Validate flight number format
 * Format: 2-3 letter airline code + 1-4 digit flight number
 */
export function isValidFlightNumberFormat(flightNumber: string): boolean {
  // Allow 2-3 alphanumeric airline code + 1-5 digit flight number
  // Some IATA codes contain digits (e.g., "P4" for Air Peace)
  const pattern = /^[a-zA-Z0-9]{2,3}\d{1,5}$/;
  return pattern.test(flightNumber);
}

/**
 * Handle FlightAware API error responses
 */
function handleFlightAwareApiError(
  status: number,
  statusText: string,
  errorText: string,
  flightNum: string,
): FlightValidationResult {
  logger.warn("FlightAware API error", { status, errorText, flightNum });

  if (status === 404) {
    logger.debug("Flight not found", { flightNum });
    return { type: "notFound" };
  }

  if (status === 401) {
    throw new Error("FlightAware API authentication failed. Check API key.");
  }

  if (status === 429) {
    throw new Error("FlightAware API rate limit exceeded. Try again later.");
  }

  throw new Error(`FlightAware API error: ${status} ${statusText} - ${errorText}`);
}

/**
 * Convert arrival date to Lagos timezone date string (YYYY-MM-DD)
 */
function toLagosDateString(arrivalDate: Date): string {
  const lagosTime = new Date(arrivalDate.toLocaleString("en-US", { timeZone: "Africa/Lagos" }));
  return `${lagosTime.getFullYear()}-${String(lagosTime.getMonth() + 1).padStart(2, "0")}-${String(lagosTime.getDate()).padStart(2, "0")}`;
}

/**
 * Format arrival time in Lagos timezone for display
 */
function formatLagosTime(arrivalTimeUTC: string): string {
  return new Date(arrivalTimeUTC).toLocaleTimeString("en-US", {
    timeZone: "Africa/Lagos",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function parseFlightIdentifier(flightNumber: string): {
  normalized: string;
  airlineCode: string;
  flightDigits: string;
} {
  const normalized = flightNumber.trim().toUpperCase();
  const match = /^([A-Z0-9]{2,3})(\d{1,5})$/i.exec(normalized);
  return {
    normalized,
    airlineCode: match?.[1]?.toUpperCase() ?? "",
    flightDigits: match?.[2] ?? "",
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getAirportField(
  record: Record<string, unknown>,
  key: "origin" | "destination",
): {
  code?: string;
  codeIata?: string;
  name?: string;
  city?: string;
} {
  const field = record[key];
  if (typeof field === "string") {
    return { code: field };
  }
  const parsed = asRecord(field);
  if (!parsed) return {};
  return {
    code: readString(parsed, "code"),
    codeIata: readString(parsed, "code_iata"),
    name: readString(parsed, "name"),
    city: readString(parsed, "city"),
  };
}

function manifestRecordMatchesFlight(
  record: Record<string, unknown>,
  target: ReturnType<typeof parseFlightIdentifier>,
): boolean {
  const candidateIdents = [
    readString(record, "ident_iata"),
    readString(record, "actual_ident_iata"),
    readString(record, "ident"),
    readString(record, "actual_ident"),
    readString(record, "ident_icao"),
    readString(record, "actual_ident_icao"),
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toUpperCase());

  if (candidateIdents.includes(target.normalized)) {
    return true;
  }

  const operatorIata = readString(record, "operator_iata")?.toUpperCase();
  const operatorIcao = readString(record, "operator_icao")?.toUpperCase();
  const flightDigits = readString(record, "flight_number");
  if (flightDigits && target.flightDigits && flightDigits === target.flightDigits) {
    if (!target.airlineCode) return true;
    if (operatorIata === target.airlineCode || operatorIcao === target.airlineCode) {
      return true;
    }
    return candidateIdents.some((ident) => ident.startsWith(target.airlineCode));
  }

  return false;
}

function getManifestArrivalTime(record: Record<string, unknown>): string | undefined {
  return (
    readString(record, "actual_on") ||
    readString(record, "estimated_on") ||
    readString(record, "scheduled_on") ||
    readString(record, "estimated_in") ||
    readString(record, "scheduled_in")
  );
}

function getManifestActualTime(record: Record<string, unknown>): string | undefined {
  return readString(record, "actual_on") || readString(record, "actual_in");
}

type ManifestFlightSelection = {
  upcoming: { record: Record<string, unknown>; arrivalDate: Date } | null;
  landed: { record: Record<string, unknown>; arrivalDate: Date } | null;
};

function buildLosArrivalsApiUrl(pickupDate: string): string {
  const startBound = `${pickupDate}T00:00:00+01:00`;
  const startDate = new Date(startBound);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 1);
  const endBound = toFlightAwareDateTime(endDate);
  return `https://aeroapi.flightaware.com/aeroapi/airports/LOS/flights?start=${encodeURIComponent(startBound)}&end=${encodeURIComponent(endBound)}&max_pages=1`;
}

async function fetchLosArrivalsPayload(
  flightNumber: string,
  pickupDate: string,
): Promise<FlightAwareAirportFlightsResponse | null> {
  const response = await fetch(buildLosArrivalsApiUrl(pickupDate), {
    headers: { "x-apikey": env.FLIGHTAWARE_API_KEY, Accept: "application/json" },
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.warn("FlightAware LOS arrivals fallback API error", {
      status: response.status,
      errorText,
      flightNumber,
      pickupDate,
    });
    return null;
  }

  return (await response.json()) as FlightAwareAirportFlightsResponse;
}

function selectManifestFlightsForDate(
  candidates: Record<string, unknown>[],
  pickupDate: string,
): ManifestFlightSelection {
  let upcoming: { record: Record<string, unknown>; arrivalDate: Date } | null = null;
  let landed: { record: Record<string, unknown>; arrivalDate: Date } | null = null;
  const now = new Date();

  for (const record of candidates) {
    const arrivalTime = getManifestArrivalTime(record);
    if (!arrivalTime) continue;
    const arrivalDate = new Date(arrivalTime);
    if (Number.isNaN(arrivalDate.getTime())) continue;
    if (toLagosDateString(arrivalDate) !== pickupDate) continue;

    if (arrivalDate < now) {
      // Only classify as landed when an actual arrival timestamp exists.
      const actualArrivalTime = getManifestActualTime(record);
      if (actualArrivalTime) {
        const actualArrivalDate = new Date(actualArrivalTime);
        if (
          !Number.isNaN(actualArrivalDate.getTime()) &&
          toLagosDateString(actualArrivalDate) === pickupDate &&
          actualArrivalDate < now &&
          (!landed || landed.arrivalDate < actualArrivalDate)
        ) {
          landed = { record, arrivalDate: actualArrivalDate };
        }
      }
      continue;
    }

    if (!upcoming || upcoming.arrivalDate > arrivalDate) {
      upcoming = { record, arrivalDate };
    }
  }

  return { upcoming, landed };
}

function buildManifestSuccessResult(
  record: Record<string, unknown>,
  flightNumber: string,
): FlightValidationResult | null {
  const origin = getAirportField(record, "origin");
  const destination = getAirportField(record, "destination");
  const faFlightId = readString(record, "fa_flight_id");
  const scheduledArrival = getManifestArrivalTime(record);
  if (!scheduledArrival) return null;

  return {
    type: "success",
    flight: {
      flightNumber,
      flightId: faFlightId ?? `${flightNumber}-los-manifest`,
      origin: origin.code ?? origin.codeIata ?? "UNKNOWN",
      originIATA: origin.codeIata,
      destination: destination.code ?? destination.codeIata ?? "LOS",
      destinationIATA: destination.codeIata ?? "LOS",
      scheduledArrival,
      status: readString(record, "status") ?? "Scheduled",
      aircraftType: readString(record, "aircraft_type"),
      isLive: true,
      arrivalAddress:
        destination.name && destination.city
          ? `${destination.name}, ${destination.city}`
          : undefined,
    },
  };
}

function buildManifestLandedResult(
  record: Record<string, unknown>,
  flightNumber: string,
  pickupDate: string,
): FlightValidationResult | null {
  const arrivalTime = getManifestArrivalTime(record);
  if (!arrivalTime) return null;
  return {
    type: "alreadyLanded",
    flightNumber,
    requestedDate: pickupDate,
    landedTime: formatLagosTime(arrivalTime),
  };
}

async function resolveFromLosArrivalsManifest(
  flightNumber: string,
  pickupDate: string,
): Promise<FlightValidationResult | null> {
  const payload = await fetchLosArrivalsPayload(flightNumber, pickupDate);
  if (!payload) return null;

  const target = parseFlightIdentifier(flightNumber);
  const candidates = [...(payload.arrivals ?? []), ...(payload.scheduled_arrivals ?? [])]
    .map(asRecord)
    .filter((record): record is Record<string, unknown> => record !== null)
    .filter((record) => manifestRecordMatchesFlight(record, target));

  const { upcoming, landed } = selectManifestFlightsForDate(candidates, pickupDate);
  if (upcoming) return buildManifestSuccessResult(upcoming.record, flightNumber);
  if (landed) return buildManifestLandedResult(landed.record, flightNumber, pickupDate);

  return null;
}

/**
 * FlightAware bounds are safest without milliseconds.
 * Example: 2026-03-17T12:39:03Z (not ...03.953Z)
 */
function toFlightAwareDateTime(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

/**
 * Find matching flight from API response
 */
function getLiveLegArrivalDate(flight: FlightAwareFlightLeg): Date {
  return new Date(flight.actual_on || flight.estimated_on || flight.scheduled_on);
}

function chooseEarlierFlight(
  current: FlightAwareFlightLeg | null,
  candidate: FlightAwareFlightLeg,
): FlightAwareFlightLeg {
  if (!current) return candidate;
  return getLiveLegArrivalDate(candidate) < getLiveLegArrivalDate(current) ? candidate : current;
}

function chooseLaterFlight(
  current: FlightAwareFlightLeg | null,
  candidate: FlightAwareFlightLeg,
): FlightAwareFlightLeg {
  if (!current) return candidate;
  return getLiveLegArrivalDate(candidate) > getLiveLegArrivalDate(current) ? candidate : current;
}

type LiveFlightSelectionState = {
  matchingFlightToLagos: FlightAwareFlightLeg | null;
  matchingFlightOther: FlightAwareFlightLeg | null;
  landedFlightToLagos: FlightAwareFlightLeg | null;
  landedFlightOther: FlightAwareFlightLeg | null;
};

function updateSelectionForMatchingDate(
  selection: LiveFlightSelectionState,
  flight: FlightAwareFlightLeg,
  hasLanded: boolean,
  isLagosDestination: boolean,
): void {
  if (hasLanded) {
    if (isLagosDestination) {
      selection.landedFlightToLagos = chooseLaterFlight(selection.landedFlightToLagos, flight);
    } else {
      selection.landedFlightOther = chooseLaterFlight(selection.landedFlightOther, flight);
    }
    return;
  }

  if (isLagosDestination) {
    selection.matchingFlightToLagos = chooseEarlierFlight(selection.matchingFlightToLagos, flight);
  } else {
    selection.matchingFlightOther = chooseEarlierFlight(selection.matchingFlightOther, flight);
  }
}

function findMatchingFlight(
  flights: FlightAwareFlightLeg[],
  pickupDateStr: string,
): {
  matchingFlight: FlightAwareFlightLeg | null;
  landedFlight: FlightAwareFlightLeg | null;
  nextFlightDate: string | null;
} {
  const now = new Date();
  const selection: LiveFlightSelectionState = {
    matchingFlightToLagos: null as FlightAwareFlightLeg | null,
    matchingFlightOther: null as FlightAwareFlightLeg | null,
    landedFlightToLagos: null as FlightAwareFlightLeg | null,
    landedFlightOther: null as FlightAwareFlightLeg | null,
  };
  let nextFlightDate: string | null = null;

  for (const flight of flights) {
    const arrivalDate = getLiveLegArrivalDate(flight);
    const lagosDateStr = toLagosDateString(arrivalDate);
    const isLagosDestination = flight.destination?.code_iata === "LOS";
    const hasLanded = arrivalDate < now;

    if (lagosDateStr !== pickupDateStr) {
      if (arrivalDate > now && !nextFlightDate) {
        nextFlightDate = lagosDateStr;
      }
      continue;
    }

    // Prefer LOS arrivals and choose the soonest upcoming one.
    updateSelectionForMatchingDate(selection, flight, hasLanded, isLagosDestination);
  }

  return {
    // If we already have a landed LOS leg for this date, prefer reporting that
    // over unrelated non-LOS matches on the same flight number.
    matchingFlight:
      selection.matchingFlightToLagos ??
      (selection.landedFlightToLagos ? null : selection.matchingFlightOther),
    landedFlight: selection.landedFlightToLagos ?? selection.landedFlightOther,
    nextFlightDate,
  };
}

/**
 * Build result for already landed flight
 */
function buildAlreadyLandedResult(
  landedFlight: FlightAwareFlightLeg,
  flightNumber: string,
  pickupDateStr: string,
  nextFlightDate: string | null,
): FlightValidationResult | null {
  const destinationIATA = landedFlight.destination?.code_iata;

  if (destinationIATA !== "LOS") {
    logger.debug("Flight landed but not going to Lagos", {
      flightNumber,
      pickupDateStr,
      destinationIATA,
    });
    return null;
  }

  const landedTime = formatLagosTime(
    landedFlight.actual_on || landedFlight.estimated_on || landedFlight.scheduled_on,
  );

  logger.info("Flight to Lagos has already landed", {
    flightNumber,
    pickupDateStr,
    landedTime,
    nextFlightDate,
  });

  return {
    type: "alreadyLanded",
    flightNumber,
    requestedDate: pickupDateStr,
    landedTime,
    nextFlightDate: nextFlightDate ?? undefined,
  };
}

/**
 * Build success result from matching flight
 */
function buildSuccessResult(
  matchingFlight: FlightAwareFlightLeg,
  flightNumber: string,
): FlightValidationResult {
  const originCode = matchingFlight.origin?.code;
  const destinationCode = matchingFlight.destination?.code;
  const originIATA = matchingFlight.origin?.code_iata;
  const destinationIATA = matchingFlight.destination?.code_iata;
  const destinationName = matchingFlight.destination?.name;
  const destinationCity = matchingFlight.destination?.city;

  if (!originCode || !destinationCode) {
    logger.warn("Missing origin/destination in live flight leg", {
      flightNumber,
      flightId: matchingFlight.fa_flight_id,
    });
    return { type: "notFound" };
  }

  return {
    type: "success",
    flight: {
      flightNumber,
      flightId: matchingFlight.fa_flight_id,
      origin: originCode,
      originIATA,
      destination: destinationCode,
      destinationIATA,
      scheduledArrival: matchingFlight.scheduled_on,
      estimatedArrival: matchingFlight.estimated_in,
      actualArrival: matchingFlight.actual_on,
      status: matchingFlight.status,
      aircraftType: matchingFlight.aircraft_type,
      delay: matchingFlight.delay,
      arrivalAddress:
        destinationName && destinationCity ? `${destinationName}, ${destinationCity}` : undefined,
      isLive: true,
    },
  };
}

/**
 * Fetch flight from real-time API (for flights < 2 days out)
 * Tries both IATA and ICAO flight numbers
 * Returns a result type instead of throwing errors for already-landed flights
 */
async function fetchLiveFlight(
  flightNumber: string,
  startDate: Date,
  endDate: Date,
  pickupDate: string,
): Promise<FlightValidationResult> {
  const apiKey = env.FLIGHTAWARE_API_KEY;
  const start = toFlightAwareDateTime(startDate);
  const end = toFlightAwareDateTime(endDate);

  const tryFlightNumber = async (flightNum: string): Promise<FlightValidationResult | null> => {
    const apiUrl = `https://aeroapi.flightaware.com/aeroapi/flights/${flightNum}?start=${start}&end=${end}`;
    logger.debug("FlightAware LIVE API request", { apiUrl });

    const response = await fetch(apiUrl, {
      headers: { "x-apikey": apiKey, Accept: "application/json" },
    });

    logger.debug("FlightAware API response", {
      status: response.status,
      statusText: response.statusText,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return handleFlightAwareApiError(response.status, response.statusText, errorText, flightNum);
    }

    const data: FlightAwareResponse = await response.json();
    const { matchingFlight, landedFlight, nextFlightDate } = findMatchingFlight(
      data.flights,
      pickupDate,
    );

    if (matchingFlight) {
      return buildSuccessResult(matchingFlight, flightNumber);
    }

    if (landedFlight) {
      const landedResult = buildAlreadyLandedResult(
        landedFlight,
        flightNumber,
        pickupDate,
        nextFlightDate,
      );
      if (landedResult) return landedResult;
    }

    logger.debug("No flight landing on requested date", {
      flightNum,
      pickupDate,
      flightsCount: data.flights.length,
    });
    return { type: "notFound" };
  };

  // Try with original flight number first (might be IATA or ICAO)
  logger.debug("Starting live flight validation", { flightNumber, start, end });
  let result = await tryFlightNumber(flightNumber);
  if (result && result.type !== "notFound") return result;

  // If not found, try converting IATA to ICAO (e.g., VS411 → VIR411, P47579 → APK7579)
  const icaoFlightNumber = convertIATAToICAO(flightNumber);
  if (icaoFlightNumber) {
    result = await tryFlightNumber(icaoFlightNumber);
    if (result && result.type !== "notFound") return result;
  }

  return { type: "notFound" };
}

/**
 * Fetch flight from schedules API (for flights > 2 days out)
 * Tries both IATA and ICAO flight numbers
 */
async function fetchScheduledFlight(
  flightNumber: string,
  scheduleStartIso: string,
  scheduleEndIso: string,
  pickupDate: string,
): Promise<FlightValidationResult> {
  const apiKey = env.FLIGHTAWARE_API_KEY;

  // Helper function to try a single flight number
  const tryScheduledFlight = async (flightNum: string): Promise<FlightValidationResult | null> => {
    // Extract airline code and flight number (e.g., "BA75" -> airline="BA", flight_number=75)
    // Match 2-character IATA codes (can be alphanumeric like "P4") or 3-character ICAO codes
    const match2 = /^([A-Z0-9]{2})(\d{1,5})$/i.exec(flightNum);
    const match3 = /^([A-Z0-9]{3})(\d{1,5})$/i.exec(flightNum);
    const match = match2 || match3;

    if (!match) {
      logger.debug("Invalid flight number format for schedules API", { flightNum });
      return { type: "notFound" };
    }

    const airlineCode = match[1].toUpperCase();
    const flightNumDigits = match[2];

    // Schedules API format: /schedules/{date_start}/{date_end}?airline={code}&flight_number={num}
    // Use explicit datetime bounds (UTC) to avoid ambiguous date parsing errors.
    const encodedStartBound = encodeURIComponent(scheduleStartIso);
    const encodedEndBound = encodeURIComponent(scheduleEndIso);
    const apiUrl = `https://aeroapi.flightaware.com/aeroapi/schedules/${encodedStartBound}/${encodedEndBound}?airline=${airlineCode}&flight_number=${flightNumDigits}`;

    logger.debug("FlightAware SCHEDULES API request", {
      apiUrl,
      flightNum,
      scheduleStartIso,
      scheduleEndIso,
    });

    const response = await fetch(apiUrl, {
      headers: {
        "x-apikey": apiKey,
        Accept: "application/json",
      },
    });

    logger.debug("FlightAware API response", {
      status: response.status,
      statusText: response.statusText,
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.warn("FlightAware API error", { status: response.status, errorText, flightNum });

      if (response.status === 404) {
        logger.debug("Flight not found in schedules", { flightNum });
        return { type: "notFound" };
      }

      if (response.status === 401) {
        throw new Error("FlightAware API authentication failed. Check API key.");
      }

      if (response.status === 429) {
        throw new Error("FlightAware API rate limit exceeded. Try again later.");
      }

      throw new Error(
        `FlightAware API error: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const data: FlightAwareSchedulesResponse = await response.json();

    if (!data.scheduled || data.scheduled.length === 0) {
      logger.debug("No scheduled flights found", { flightNum });
      return { type: "notFound" };
    }

    const normalizedFlight = flightNum.toUpperCase();
    const getArrivalTime = (flight: FlightAwareScheduledFlight): string | null =>
      flight.estimated_in ?? flight.scheduled_in ?? flight.actual_in ?? flight.scheduled_on ?? null;

    const flightsOnPickupDate = data.scheduled.filter((flight) => {
      const arrivalTime = getArrivalTime(flight);
      if (!arrivalTime) return false;
      return toLagosDateString(new Date(arrivalTime)) === pickupDate;
    });

    if (flightsOnPickupDate.length === 0) {
      logger.debug("No scheduled flights found on pickup date", { flightNum, pickupDate });
      return { type: "notFound" };
    }

    const getIdentifierMatchScore = (flight: FlightAwareScheduledFlight): number => {
      if (flight.ident_iata?.toUpperCase() === normalizedFlight) return 3;
      if (flight.actual_ident_iata?.toUpperCase() === normalizedFlight) return 2;
      if (flight.ident?.toUpperCase() === normalizedFlight) return 1;
      return 0;
    };

    const scheduledFlight = flightsOnPickupDate.reduce(
      (best, current) => {
        if (!best) return current;

        const bestIdScore = getIdentifierMatchScore(best);
        const currentIdScore = getIdentifierMatchScore(current);
        if (currentIdScore !== bestIdScore) {
          return currentIdScore > bestIdScore ? current : best;
        }

        const isLagosDestination = (flight: FlightAwareScheduledFlight): boolean => {
          return [flight.destination_iata, flight.destination, flight.destination_icao].some(
            (destinationCode) => destinationCode?.toUpperCase() === "LOS",
          );
        };
        const bestIsLagos = isLagosDestination(best);
        const currentIsLagos = isLagosDestination(current);
        if (currentIsLagos !== bestIsLagos) {
          return currentIsLagos ? current : best;
        }

        const bestArrival = getArrivalTime(best);
        const currentArrival = getArrivalTime(current);
        if (!bestArrival || !currentArrival) return best;

        return new Date(currentArrival) < new Date(bestArrival) ? current : best;
      },
      null as FlightAwareScheduledFlight | null,
    );

    if (!scheduledFlight) {
      return { type: "notFound" };
    }

    logger.info("[fetchScheduledFlight] Scheduled flight", { flightNumber, scheduledFlight, data });

    const scheduledArrival: string | undefined =
      scheduledFlight.estimated_in ??
      scheduledFlight.scheduled_in ??
      scheduledFlight.actual_in ??
      scheduledFlight.scheduled_on ??
      undefined;

    if (!scheduledArrival) {
      logger.warn("Missing arrival time for scheduled flight", {
        flightNum,
        payloadKeys: Object.keys(scheduledFlight),
      });
      return { type: "notFound" };
    }

    const airportsResponse = await fetch(
      `https://aeroapi.flightaware.com/aeroapi/airports/${scheduledFlight.destination}`,
      {
        headers: {
          "x-apikey": apiKey,
          Accept: "application/json",
        },
      },
    );

    let airportsData: { name?: string; city?: string } = {};
    if (airportsResponse.ok) {
      try {
        airportsData = (await airportsResponse.json()) as { name?: string; city?: string };
      } catch (error) {
        logger.warn("Failed to parse airport details response", {
          destination: scheduledFlight.destination,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } else {
      logger.warn("Airport details API returned non-success status", {
        destination: scheduledFlight.destination,
        status: airportsResponse.status,
      });
    }
    const airportName =
      typeof airportsData.name === "string" && airportsData.name.trim().length > 0
        ? airportsData.name
        : scheduledFlight.destination_iata || scheduledFlight.destination || "Destination airport";
    const airportCity =
      typeof airportsData.city === "string" && airportsData.city.trim().length > 0
        ? airportsData.city
        : "";
    const arrivalAddress = airportCity ? `${airportName}, ${airportCity}` : airportName;

    // Transform to our format (use original flightNumber for consistency)
    return {
      type: "success",
      flight: {
        flightNumber, // Use original IATA code for display
        flightId: scheduledFlight.fa_flight_id || `${flightNumber}-scheduled`,
        origin: scheduledFlight.origin,
        originIATA: scheduledFlight.origin_iata ?? undefined,
        destination: scheduledFlight.destination,
        destinationIATA: scheduledFlight.destination_iata ?? undefined,
        scheduledArrival,
        arrivalAddress,
        status: "Scheduled",
        aircraftType: scheduledFlight.aircraft_type ?? undefined,
        isLive: false,
      },
    };
  };

  // Try with original flight number first (might be IATA or ICAO)
  let result = await tryScheduledFlight(flightNumber);
  if (result && result.type !== "notFound") return result;

  // If not found, try converting IATA to ICAO (e.g., VS411 → VIR411, P47579 → APK7579)
  const icaoFlightNumber = convertIATAToICAO(flightNumber);
  if (icaoFlightNumber) {
    result = await tryScheduledFlight(icaoFlightNumber);
    if (result && result.type !== "notFound") return result;
  }

  return { type: "notFound" };
}

/**
 * Validate and search for a flight using FlightAware AeroAPI
 *
 * @param flightNumber - IATA flight number (e.g., "BA74", "AA123")
 * @param pickupDate - ISO date string (e.g., "2025-12-25")
 * @returns FlightValidationResult - a result type indicating success, already landed, not found, or error
 */
export async function validateFlight(
  flightNumber: string,
  pickupDate: string,
): Promise<FlightValidationResult> {
  // 1. Validate format
  if (!isValidFlightNumberFormat(flightNumber)) {
    return {
      type: "error",
      message: `Invalid flight number format: ${flightNumber}. Expected format: 2-3 alphanumeric airline code + 1-5 digits (e.g., BA74, AA123, P47579)`,
    };
  }

  // Normalize flight number to uppercase
  const normalizedFlightNumber = flightNumber.toUpperCase();

  logger.debug("Flight validation - calling API", {
    flightNumber: normalizedFlightNumber,
    pickupDate,
  });

  // 3. Calculate search window and determine which API to use
  // The pickupDate is in YYYY-MM-DD format and represents a Lagos date
  // We need to search for flights landing on that Lagos date
  // To account for timezone differences, we search from 12 hours before to 12 hours after
  const startDate = new Date(pickupDate);
  startDate.setHours(0, 0, 0, 0);
  startDate.setHours(startDate.getHours() - 12); // Start 12 hours before midnight

  const endDate = new Date(pickupDate);
  endDate.setDate(endDate.getDate() + 1);
  endDate.setHours(0, 0, 0, 0);
  endDate.setHours(endDate.getHours() + 12); // End 12 hours after next midnight

  // Calculate how far in the future this booking is (using date-fns)
  const now = new Date();
  const diffDays = differenceInDays(startDate, now);

  // 4. Get API key
  // const apiKey = env.FLIGHTAWARE_API_KEY;

  // 5. HYBRID STRATEGY: Choose endpoint based on how far in the future
  // FlightAware live API supports flights up to 2 days in the future
  // Use live API for flights within 2 days (today = 0, tomorrow = 1)
  // Anything >= 2 days (day after tomorrow onwards) uses Schedules API
  const useLiveAPI = diffDays < 2;

  try {
    let result: FlightValidationResult;

    if (useLiveAPI) {
      // Use real-time API for flights within 2 days
      // FlightAware live API has a 2-day limit, so cap the endDate to be at most 2 days from now
      const maxEndDate = new Date(now);
      maxEndDate.setDate(maxEndDate.getDate() + 2);

      // Use whichever is earlier: calculated endDate or max allowed endDate
      const cappedEndDate = new Date(Math.min(endDate.getTime(), maxEndDate.getTime()));

      if (endDate > maxEndDate) {
        logger.debug("Capping endDate due to 2-day limit", {
          originalEndDate: endDate.toISOString(),
          cappedEndDate: cappedEndDate.toISOString(),
        });
      }

      result = await fetchLiveFlight(normalizedFlightNumber, startDate, cappedEndDate, pickupDate);
    } else {
      // Use schedules API for flights more than 2 days out
      // Use a schedules-specific UTC day window for stable bounds parsing in AeroAPI.
      const scheduleStartDate = new Date(`${pickupDate}T00:00:00.000Z`);
      const scheduleEndDate = new Date(scheduleStartDate);
      scheduleEndDate.setUTCDate(scheduleEndDate.getUTCDate() + 1);

      result = await fetchScheduledFlight(
        normalizedFlightNumber,
        toFlightAwareDateTime(scheduleStartDate),
        toFlightAwareDateTime(scheduleEndDate),
        pickupDate,
      );
    }

    if (result.type === "notFound") {
      const fallbackResult = await resolveFromLosArrivalsManifest(
        normalizedFlightNumber,
        pickupDate,
      );
      if (fallbackResult) {
        result = fallbackResult;
      }
    }

    return result;
  } catch (error) {
    // Handle unexpected errors
    if (error instanceof Error) {
      logger.error(
        `[FlightAware] Error validating flight ${normalizedFlightNumber}: ${error.message}`,
      );
      return { type: "error", message: error.message };
    }

    return {
      type: "error",
      message: "An unexpected error occurred while validating the flight",
    };
  }
}
