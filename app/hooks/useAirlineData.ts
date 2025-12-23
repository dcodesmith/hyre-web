import { useCallback, useMemo } from "react";
import airlinesData from "~/data/airlines.json";

export interface Airline {
  id: string;
  name: string;
  alias: string;
  iata: string;
  icao: string;
  callsign: string;
  country: string;
  active: string;
  fliestoNigeria?: boolean;
}

/**
 * Hook to access and filter airline data
 * Returns only active airlines with valid IATA codes
 */
export function useAirlineData(options?: { nigeriaOnly?: boolean }) {
  const activeAirlines = useMemo(() => {
    const filtered = (airlinesData as Airline[]).filter(
      (airline) =>
        airline.active === "Y" &&
        airline.iata &&
        airline.iata !== "" &&
        airline.iata !== "-" &&
        airline.iata !== "\\N" &&
        airline.iata.length >= 2,
    );

    // Further filter to only airlines that fly to Nigeria if requested
    let result = filtered;
    if (options?.nigeriaOnly) {
      result = filtered.filter((airline) => airline.fliestoNigeria === true);
    }

    return result;
  }, [options?.nigeriaOnly]);

  /**
   * Filter airlines by query string
   * Matches against IATA code and airline name
   */
  const filterAirlines = useCallback(
    (query: string): Airline[] => {
      if (!query || query.length < 2) {
        return [];
      }

      const normalizedQuery = query.toLowerCase().trim();

      // Extract potential airline code (2-3 alphanumeric characters)
      // Try 2 characters first (IATA codes like "P4", "BA"), then 3 (ICAO codes like "APK")
      // This correctly handles:
      // - "BA123" -> "BA" (2 letters)
      // - "P47579" -> "P4" (2 alphanumeric: letter + digit)
      // - "APK7579" -> "APK" (3 letters)
      // - "P4" -> "P4" (just airline code, no flight number)
      // Some IATA codes contain digits (e.g., "P4" for Air Peace)
      let airlineCode: string | null = null;
      const match2 = /^([a-z0-9]{2})(\d*)$/i.exec(normalizedQuery);
      const match3 = /^([a-z0-9]{3})(\d*)$/i.exec(normalizedQuery);

      // Prefer 2-character codes (IATA) if they match, otherwise try 3-character (ICAO)
      if (match2?.[1]) {
        airlineCode = match2[1].toUpperCase();
      } else if (match3?.[1]) {
        airlineCode = match3[1].toUpperCase();
      }

      // ICAO codes are always 3 letters (no digits)
      const isICAOCode = airlineCode?.length === 3 && /^[A-Z]{3}$/.test(airlineCode);

      const filtered = activeAirlines
        .filter((airline) => {
          // Match by IATA code (highest priority) - for 2-character codes (can be alphanumeric like "P4")
          if (airlineCode && !isICAOCode && airline.iata.toUpperCase() === airlineCode) {
            return true;
          }

          // Match by ICAO code (for 3-letter codes like "APK")
          if (
            airlineCode &&
            isICAOCode &&
            airline.icao &&
            airline.icao.toUpperCase() === airlineCode
          ) {
            return true;
          }

          // Match by airline name
          if (airline.name.toLowerCase().includes(normalizedQuery)) {
            return true;
          }

          // Match if query contains the IATA code
          if (airline.iata.toLowerCase() === normalizedQuery) {
            return true;
          }

          return false;
        })
        .slice(0, 10); // Limit to 10 results for performance

      return filtered;
    },
    [activeAirlines],
  );

  /**
   * Get airline by IATA code
   */
  const getAirlineByIATA = (iataCode: string): Airline | undefined => {
    return activeAirlines.find((airline) => airline.iata.toUpperCase() === iataCode.toUpperCase());
  };

  return {
    activeAirlines,
    filterAirlines,
    getAirlineByIATA,
  };
}
