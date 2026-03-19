import { useCallback, useState } from "react";
import type { ValidatedFlight } from "~/services/flight-validation.server";

interface FlightValidationResponse {
  success: boolean;
  flight?: ValidatedFlight;
  error?: string | { code?: string; message?: string };
  shortError?: string;
  message?: string;
  shortMessage?: string;
  warning?: string;
  shortWarning?: string;
  errorType?:
    | "non_lagos_destination"
    | "already_landed"
    | "not_found"
    | "invalid_format"
    | "past_date"
    | "insufficient_notice";
}

interface UseFlightValidationReturn {
  validateFlight: (flightNumber: string, date: string) => Promise<ValidatedFlight | null>;
  resetValidation: () => void;
  isValidating: boolean;
  message: string | null;
  shortMessage: string | null;
  flight: ValidatedFlight | null;
  isWarning: boolean;
  errorType: FlightValidationResponse["errorType"] | null;
}

/**
 * Client-side hook to validate flight numbers via the API
 *
 * @example
 * const { validateFlight, isValidating, error, flight } = useFlightValidation();
 *
 * // In an async handler:
 * const result = await validateFlight("BA74", "2025-12-25");
 * if (result) {
 *   console.log("Flight found:", result);
 * }
 */
export function useFlightValidation(): UseFlightValidationReturn {
  const [isValidating, setIsValidating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [shortMessage, setShortMessage] = useState<string | null>(null);
  const [flight, setFlight] = useState<ValidatedFlight | null>(null);
  const [isWarning, setIsWarning] = useState(false);
  const [errorType, setErrorType] = useState<FlightValidationResponse["errorType"] | null>(null);

  const resetValidation = useCallback(() => {
    setMessage(null);
    setShortMessage(null);
    setFlight(null);
    setIsWarning(false);
    setErrorType(null);
  }, []);

  const validateFlight = useCallback(async (flightNumber: string, date: string) => {
    // biome-ignore lint/suspicious/noConsoleLog: Debug flight validation
    console.log("[useFlightValidation] validateFlight called with:", { flightNumber, date });

    setIsValidating(true);
    setMessage(null);
    setShortMessage(null);
    setFlight(null);
    setIsWarning(false);
    setErrorType(null);

    try {
      const params = new URLSearchParams({
        flightNumber,
        date,
      });

      const response = await fetch(`/api/search-flight?${params.toString()}`);
      const data: FlightValidationResponse = await response.json();

      if (data.success && data.flight) {
        setFlight(data.flight);

        if (data.warning) {
          setMessage(data.warning);
          setShortMessage(data.shortWarning ?? data.warning);
          setIsWarning(true);
        }

        return data.flight;
      }

      if (data.success && data.message) {
        setMessage(data.message);
        setShortMessage(data.shortMessage ?? data.message);
        setIsWarning(false);
        setErrorType(data.errorType ?? null);
        return null;
      }

      const errorMsg =
        typeof data.error === "string"
          ? data.error
          : data.error?.message || "Flight validation failed";
      setMessage(errorMsg);
      setShortMessage(data.shortError ?? errorMsg);
      setIsWarning(false);
      setErrorType(data.errorType ?? (typeof data.error === "object" ? data.error?.code : null));
      return null;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";

      setMessage(errorMessage);
      setShortMessage("Something went wrong");
      setIsWarning(false);
      setErrorType(null);
      return null;
    } finally {
      setIsValidating(false);
    }
  }, []);

  return {
    validateFlight,
    resetValidation,
    isValidating,
    message,
    shortMessage,
    flight,
    isWarning,
    errorType,
  };
}
