import { differenceInDays } from "date-fns";
import logger from "~/lib/logger.server";
import { env } from "~/utils/server/env.server";

/**
 * Constants
 */
const CACHE_TTL_HOURS = 24;
const CACHE_CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

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
  };
  destination: {
    code: string;
    code_iata?: string;
    name?: string;
    city?: string;
  };
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
 * In-memory cache for flight validation results
 * TTL: 24 hours
 * Only caches "success" and "notFound" results (not "alreadyLanded" or "error" - those are time-sensitive)
 * Format: Map<cacheKey, { data: FlightValidationResult, expiresAt: timestamp }>
 */
const flightCache = new Map<
  string,
  {
    data: FlightValidationResult;
    expiresAt: number;
  }
>();

/**
 * Clean up expired cache entries
 * Prevents memory leaks by removing stale entries
 */
function cleanupExpiredCacheEntries(): void {
  const now = Date.now();
  let removedCount = 0;

  for (const [key, value] of flightCache.entries()) {
    if (now > value.expiresAt) {
      flightCache.delete(key);
      removedCount++;
    }
  }

  if (removedCount > 0) {
    logger.info("Cleaned up expired cache entries", {
      removedCount,
      remainingCount: flightCache.size,
    });
  }
}

/**
 * Start periodic cache cleanup
 * Only runs in server environment (not during build)
 */
if (typeof setInterval !== "undefined") {
  setInterval(cleanupExpiredCacheEntries, CACHE_CLEANUP_INTERVAL_MS);
  logger.info("Flight cache cleanup scheduled", {
    intervalMinutes: CACHE_CLEANUP_INTERVAL_MS / 60000,
  });
}

/**
 * Generate cache key for flight lookup
 */
function getCacheKey(flightNumber: string, date: string): string {
  return `flight:${flightNumber.toUpperCase()}:${date}`;
}

/**
 * Get cached flight data if available and not expired
 */
function getCachedFlight(flightNumber: string, date: string): FlightValidationResult | undefined {
  const key = getCacheKey(flightNumber, date);
  const cached = flightCache.get(key);

  if (!cached) {
    return undefined; // No cache entry
  }

  if (Date.now() > cached.expiresAt) {
    // Expired - remove from cache
    flightCache.delete(key);
    return undefined;
  }

  return cached.data;
}

/**
 * Cache flight data with configurable TTL
 * Only caches "success" and "notFound" results (not "alreadyLanded" or "error")
 */
function setCachedFlight(
  flightNumber: string,
  date: string,
  data: FlightValidationResult,
  ttlHours = CACHE_TTL_HOURS,
): void {
  // Don't cache "alreadyLanded" or "error" results - they're time-sensitive
  if (data.type === "alreadyLanded" || data.type === "error") {
    return;
  }

  const key = getCacheKey(flightNumber, date);
  const expiresAt = Date.now() + ttlHours * 60 * 60 * 1000;

  flightCache.set(key, { data, expiresAt });
}

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

/**
 * Find matching flight from API response
 */
function findMatchingFlight(
  flights: FlightAwareFlightLeg[],
  pickupDateStr: string,
): {
  matchingFlight: FlightAwareFlightLeg | null;
  landedFlight: FlightAwareFlightLeg | null;
  nextFlightDate: string | null;
} {
  const now = new Date();
  let matchingFlight: FlightAwareFlightLeg | null = null;
  let landedFlight: FlightAwareFlightLeg | null = null;
  let nextFlightDate: string | null = null;

  for (const flight of flights) {
    const arrivalTimeUTC = flight.actual_on || flight.estimated_on || flight.scheduled_on;
    const arrivalDate = new Date(arrivalTimeUTC);
    const lagosDateStr = toLagosDateString(arrivalDate);

    if (lagosDateStr === pickupDateStr) {
      if (arrivalDate < now) {
        landedFlight = flight;
      } else {
        matchingFlight = flight;
        break;
      }
    } else if (arrivalDate > now && !nextFlightDate) {
      nextFlightDate = lagosDateStr;
    }
  }

  return { matchingFlight, landedFlight, nextFlightDate };
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
  const destinationIATA = landedFlight.destination.code_iata;

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
  return {
    type: "success",
    flight: {
      flightNumber,
      flightId: matchingFlight.fa_flight_id,
      origin: matchingFlight.origin.code,
      originIATA: matchingFlight.origin.code_iata,
      destination: matchingFlight.destination.code,
      destinationIATA: matchingFlight.destination.code_iata,
      scheduledArrival: matchingFlight.scheduled_on,
      estimatedArrival: matchingFlight.estimated_in,
      actualArrival: matchingFlight.actual_on,
      status: matchingFlight.status,
      aircraftType: matchingFlight.aircraft_type,
      delay: matchingFlight.delay,
      arrivalAddress: `${matchingFlight.destination.name}, ${matchingFlight.destination.city}`,
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
  const start = startDate.toISOString();
  const end = endDate.toISOString();

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
  startDate: Date,
  endDate: Date,
): Promise<FlightValidationResult> {
  const apiKey = env.FLIGHTAWARE_API_KEY;

  const startDateStr = startDate.toISOString().split("T")[0]; // YYYY-MM-DD
  const endDateStr = endDate.toISOString().split("T")[0]; // YYYY-MM-DD

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
    const apiUrl = `https://aeroapi.flightaware.com/aeroapi/schedules/${startDateStr}/${endDateStr}?airline=${airlineCode}&flight_number=${flightNumDigits}`;

    logger.debug("FlightAware SCHEDULES API request", { apiUrl });

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
    const scheduledFlight =
      data.scheduled.find(
        (flight) =>
          flight.ident_iata?.toUpperCase() === normalizedFlight ||
          flight.actual_ident_iata?.toUpperCase() === normalizedFlight ||
          flight.ident?.toUpperCase() === normalizedFlight,
      ) ?? data.scheduled[0];

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

    const airportsData = await airportsResponse.json();

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
        arrivalAddress: `${airportsData.name}, ${airportsData.city}`,
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

  // 2. Check cache first
  const cached = getCachedFlight(normalizedFlightNumber, pickupDate);
  if (cached !== undefined) {
    logger.debug("Flight cache HIT", { flightNumber: normalizedFlightNumber, pickupDate });
    return cached;
  }

  logger.debug("Flight cache MISS - calling API", {
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
      result = await fetchScheduledFlight(normalizedFlightNumber, startDate, endDate);
    }

    // Cache the result (only caches "success" and "notFound" - "alreadyLanded" and "error" are not cached)
    setCachedFlight(normalizedFlightNumber, pickupDate, result);

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

/**
 * Clear expired cache entries
 * Call this periodically or on server startup
 */
export function cleanFlightCache(): void {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, value] of flightCache.entries()) {
    if (now > value.expiresAt) {
      flightCache.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    logger.debug("Flight cache cleanup", { cleanedEntries: cleaned });
  }
}

/**
 * Get cache statistics (useful for monitoring)
 */
export function getFlightCacheStats() {
  return {
    size: flightCache.size,
    entries: Array.from(flightCache.keys()),
  };
}
