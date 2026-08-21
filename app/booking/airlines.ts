import airlinesData from "~/booking/airlines.json";

export interface Airline {
  readonly id: string;
  readonly name: string;
  readonly iata: string;
  readonly icao: string;
}

const INVALID_IATA = new Set(["", "-", String.raw`\N`]);
const PARTIAL_AIRLINE_CODE = /^[A-Z0-9]{2,3}$/i;
const FLIGHT_CODE_AND_DIGITS = /^([A-Z0-9]+)(\d+)$/i;
const TWO_CHAR_PREFIX = /^([A-Z0-9]{2})(\d*)$/i;
const THREE_CHAR_PREFIX = /^([A-Z0-9]{3})(\d*)$/i;
const ICAO_CODE = /^[A-Z]{3}$/;
const MAX_SUGGESTIONS = 10;

const nigeriaAirlines: Airline[] = airlinesData.flatMap((airline) => {
  if (
    airline.active !== "Y" ||
    airline.fliestoNigeria !== true ||
    INVALID_IATA.has(airline.iata) ||
    airline.iata.length < 2
  ) {
    return [];
  }

  return [
    {
      id: airline.id,
      name: airline.name,
      iata: airline.iata,
      icao: airline.icao,
    },
  ];
});

function isCompleteTypedFlightNumber(input: string) {
  const match = FLIGHT_CODE_AND_DIGITS.exec(input);

  return Boolean(match?.[1] && match[1].length >= 2);
}

export function shouldSuggestAirlines(query: string) {
  const input = query.trim();

  return PARTIAL_AIRLINE_CODE.test(input) || isCompleteTypedFlightNumber(input);
}

function digitsAfterPrefix(value: string, prefix: string) {
  if (!prefix || !value.startsWith(prefix) || value.length === prefix.length) {
    return "";
  }

  const digits = value.slice(prefix.length);

  return /^\d+$/.test(digits) ? digits : "";
}

export function extractFlightDigits(query: string, airline: Airline) {
  const normalized = query.trim().toUpperCase();
  const iata = airline.iata.toUpperCase();
  const icao = airline.icao.toUpperCase();

  return digitsAfterPrefix(normalized, iata) || digitsAfterPrefix(normalized, icao);
}

export function formatAirlineFlight(airline: Airline, digits: string) {
  return `${airline.iata}${digits}`.toUpperCase();
}

export function filterAirlines(query: string): Airline[] {
  if (!shouldSuggestAirlines(query)) {
    return [];
  }

  const normalized = query.toLowerCase().trim();
  const two = TWO_CHAR_PREFIX.exec(normalized);
  const three = THREE_CHAR_PREFIX.exec(normalized);
  const airlineCode = (two?.[1] ?? three?.[1] ?? "").toUpperCase();
  const isIcao = ICAO_CODE.test(airlineCode);

  return nigeriaAirlines
    .filter((airline) => {
      if (airlineCode && !isIcao && airline.iata.toUpperCase() === airlineCode) {
        return true;
      }

      if (airlineCode && isIcao && airline.icao.toUpperCase() === airlineCode) {
        return true;
      }

      return airline.name.toLowerCase().includes(normalized);
    })
    .slice(0, MAX_SUGGESTIONS);
}
