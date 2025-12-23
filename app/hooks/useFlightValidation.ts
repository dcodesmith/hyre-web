import { useCallback, useState } from "react";
import type { ValidatedFlight } from "~/services/flight-validation.server";

interface FlightValidationResponse {
  success: boolean;
  flight?: ValidatedFlight;
  error?: string;
  message?: string;
  warning?: string; // Warning message for successful validations with caveats
  errorType?: "already_landed" | "insufficient_notice";
}

interface UseFlightValidationReturn {
  validateFlight: (flightNumber: string, date: string) => Promise<ValidatedFlight | null>;
  isValidating: boolean;
  message: string | null; // Message for both success and error cases
  flight: ValidatedFlight | null;
  isWarning: boolean; // True if message is a warning (not a hard error)
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
  const [flight, setFlight] = useState<ValidatedFlight | null>(null);
  const [isWarning, setIsWarning] = useState(false);

  const validateFlight = useCallback(async (flightNumber: string, date: string) => {
    // biome-ignore lint/suspicious/noConsoleLog: Debug flight validation
    console.log("[useFlightValidation] validateFlight called with:", { flightNumber, date });

    setIsValidating(true);
    setMessage(null);
    setFlight(null);
    setIsWarning(false);

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
          setIsWarning(true);
        }

        return data.flight;
      }

      // Handle informational message case (success=true but flight=null, e.g., doesn't fly to Lagos)
      if (data.success && data.message) {
        setMessage(data.message);
        setIsWarning(false); // Informational, not a warning
        return null;
      }

      // Handle hard error case (success=false, no errorType - flight not found, etc.)

      setMessage(data.error || "Flight validation failed");
      setIsWarning(false);
      return null;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";

      setMessage(errorMessage);
      setIsWarning(false);
      return null;
    } finally {
      setIsValidating(false);
    }
  }, []);

  return {
    validateFlight,
    isValidating,
    message,
    flight,
    isWarning,
  };
}
