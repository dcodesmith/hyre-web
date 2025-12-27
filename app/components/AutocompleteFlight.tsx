import { CheckCircle, Plane, XCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { type Airline, useAirlineData } from "~/hooks/useAirlineData";
import { useFlightValidation } from "~/hooks/useFlightValidation";
import { cn } from "~/lib/utils";
import type { ValidatedFlight } from "~/services/flight-validation.server";
import { Input } from "./ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

interface AutocompleteFlightProps {
  readonly id: string;
  readonly onSelect: (flightNumber: string) => void;
  readonly inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
  readonly placeholder?: string;
  readonly className?: string;
  readonly initialValue?: string;
  readonly nigeriaOnly?: boolean;
  readonly pickupDate?: string; // ISO date for validation (e.g., "2025-12-25")
  readonly onFlightValidated?: (flight: ValidatedFlight | null) => void; // Callback with flight details
  readonly onValidationError?: (message: string | null, isWarning: boolean) => void; // Optional error callback
  readonly showValidation?: boolean; // Whether to render inline validation UI
}

export function AutocompleteFlight({
  id,
  onSelect,
  inputProps,
  placeholder = "Flight Number (BA74, AA123)",
  className,
  initialValue = "",
  nigeriaOnly = false,
  pickupDate,
  onFlightValidated,
  onValidationError,
  showValidation = true,
}: AutocompleteFlightProps) {
  const [query, setQuery] = useState<string>(initialValue);
  const [suggestions, setSuggestions] = useState<Airline[]>([]);
  const [open, setOpen] = useState<boolean>(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState<boolean>(false);
  const [filterError, setFilterError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const { filterAirlines } = useAirlineData({ nigeriaOnly });
  const {
    validateFlight,
    isValidating,
    message: validationMessage,
    flight: validatedFlight,
    isWarning: validationIsWarning,
  } = useFlightValidation();

  // Effect to handle initial value - syncs from form state to component state
  useEffect(() => {
    setQuery(initialValue);
  }, [initialValue]);

  /**
   * Extract flight number digits from query based on airline IATA/ICAO codes
   */
  const extractFlightNumber = useCallback((queryStr: string, airline: Airline): string => {
    const normalizedQuery = queryStr.toUpperCase();
    const airlineIATA = airline.iata.toUpperCase();
    const airlineICAO = airline.icao?.toUpperCase() || "";

    if (normalizedQuery === airlineIATA || normalizedQuery === airlineICAO) {
      return "";
    }

    // Try IATA match first (e.g., "BA75" -> "75")
    const iataMatch = new RegExp(String.raw`^${airlineIATA}(\d+)$`).exec(normalizedQuery);
    if (iataMatch?.[1]) {
      return iataMatch[1];
    }

    // Try ICAO match (e.g., "BAW75" -> "75")
    if (airlineICAO) {
      const icaoMatch = new RegExp(String.raw`^${airlineICAO}(\d+)$`).exec(normalizedQuery);
      if (icaoMatch?.[1]) {
        return icaoMatch[1];
      }
    }

    return "";
  }, []);

  const fetchSuggestions = useCallback(
    (input: string) => {
      if (input.length < 2) {
        setSuggestions([]);
        setOpen(false);
        return;
      }

      // Allow partial airline codes (2-3 alphanumeric) OR full flight numbers (airline code + digits)
      // This allows users to see suggestions when typing just "P4" or "APK", and also when typing "P47579"
      const partialAirlineCodePattern = /^[a-zA-Z0-9]{2,3}$/; // Just airline code (e.g., "P4", "APK")
      // For full flight numbers, use a more lenient pattern that allows any alphanumeric prefix followed by digits
      // The extraction logic will correctly parse "P4" from "P47579" even if pattern matches "P47"
      // Pattern: at least 2 alphanumeric chars (airline code) + at least 1 digit (flight number)
      const fullFlightNumberPattern = /^[a-zA-Z0-9]{2,}\d+$/; // At least 2 alphanumeric + at least 1 digit

      const isPartialCode = partialAirlineCodePattern.test(input);
      const isFullFlightNumber = fullFlightNumberPattern.test(input);
      const shouldShowSuggestions = isPartialCode || isFullFlightNumber;

      if (!shouldShowSuggestions) {
        // Invalid format - don't show suggestions
        setSuggestions([]);
        setOpen(false);
        return;
      }

      setIsLoadingSuggestions(true);
      setFilterError(null);

      try {
        const results = filterAirlines(input);
        setSuggestions(results);
        setOpen(results.length > 0);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to load airline suggestions";
        setFilterError(errorMessage);
        setSuggestions([]);
        setOpen(false);
      } finally {
        setIsLoadingSuggestions(false);
      }
    },
    [filterAirlines],
  );

  const handleValidationResult = useCallback(
    async (flightNumber: string, date: string) => {
      try {
        const result = await validateFlight(flightNumber, date);

        if (result) {
          // Flight found - call success callback
          if (onFlightValidated) {
            onFlightValidated(result);
          }
          // Clear any previous errors
          if (onValidationError) {
            onValidationError(null, false);
          }
        } else if (onFlightValidated) {
          // Flight not found or validation failed
          // The error is already set in the validationError state by the hook
          // Clear any previous validated flight
          onFlightValidated(null);
        }
      } catch (error) {
        // Validation error occurred
        const errorMessage = error instanceof Error ? error.message : "Failed to validate flight";
        if (onValidationError) {
          onValidationError(errorMessage, false);
        }
        // Clear any previous validated flight
        if (onFlightValidated) {
          onFlightValidated(null);
        }
      }
    },
    [validateFlight, onFlightValidated, onValidationError],
  );

  const handleSelect = useCallback(
    async (airline: Airline) => {
      // Extract flight number from query if it exists
      // Only extract digits that come AFTER the airline code
      // For "P4", don't extract "4" as flight number (it's part of the code)
      // For "P47579", extract "7579" (comes after "P4")
      const flightNumber = extractFlightNumber(query, airline);
      // Format as "IATA CODE + flight number" (e.g., "BA123", "P47579")
      // If no flight number extracted, just use the airline code
      const formattedFlight = flightNumber
        ? `${airline.iata}${flightNumber}`.toUpperCase()
        : airline.iata.toUpperCase();

      setQuery(formattedFlight);
      setOpen(false);
      setSuggestions([]);
      // Update form state via onSelect callback (not via inputProps.onChange to avoid conflicts)
      onSelect(formattedFlight);

      // Validate flight if pickupDate is provided
      if (pickupDate) {
        await handleValidationResult(formattedFlight, pickupDate);
      }
    },
    [query, onSelect, pickupDate, handleValidationResult, extractFlightNumber],
  );

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    setQuery(newValue);

    if (newValue.length >= 2) {
      fetchSuggestions(newValue);
    } else {
      setSuggestions([]);
      setOpen(false);
    }

    // DO NOT call inputProps.onChange here - we manage form state via onSelect callback
    // Calling both would cause duplicate updates and value concatenation issues
    // The form state is updated when user selects from dropdown via onSelect -> onAddressUpdate -> form.update
  };

  // Remove value, onChange, defaultValue, and name from inputProps
  // We control value/onChange ourselves, and name can cause conflicts with form state
  const {
    value: _omitValue,
    onChange: _omitOnChange,
    defaultValue: _omitDefaultValue,
    name: _omitName,
    ...sanitizedInputProps
  } = inputProps || {};

  // Notify parent of validation messages when they occur
  useEffect(() => {
    if (onValidationError) {
      onValidationError(validationMessage, validationIsWarning);
    }
  }, [validationMessage, validationIsWarning, onValidationError]);

  return (
    <div className="w-full">
      {/* Hidden input for form submission - syncs with query state */}
      {inputProps?.name && <input type="hidden" name={inputProps.name} value={query} />}
      <Popover open={open && suggestions.length > 0} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Input
              ref={inputRef}
              value={query}
              onChange={handleInputChange}
              onFocus={() => {
                if (query.length >= 2 && suggestions.length > 0) {
                  setOpen(true);
                }
              }}
              placeholder={placeholder}
              className={cn("w-full rounded-sm", className)}
              autoComplete={inputProps?.autoComplete || "off"}
              {...sanitizedInputProps}
            />
            {(isLoadingSuggestions || isValidating) && (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-gray-500 font-medium">
                <span className="inline-flex">
                  <span className="animate-ellipsis">.</span>
                  <span className="animate-ellipsis [animation-delay:0.2s]">.</span>
                  <span className="animate-ellipsis [animation-delay:0.4s]">.</span>
                </span>
              </span>
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[--radix-popover-trigger-width] bg-white shadow-md rounded-md p-2 z-50"
          style={{ width: "var(--radix-popover-trigger-width)" }}
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <ul className="max-h-60 overflow-y-auto">
            {suggestions.map((airline) => {
              // Extract flight number from query if it exists
              // Only extract digits that come AFTER the airline code
              // For "P4", don't extract "4" as flight number (it's part of the code)
              // For "P47579", extract "7579" (comes after "P4")
              // For "APK7579", extract "7579" (comes after "APK")
              const flightNumber = extractFlightNumber(query, airline);

              const formattedFlightNumber = flightNumber
                ? `${airline.iata}${flightNumber}`.toUpperCase()
                : airline.iata.toUpperCase();

              return (
                <li key={airline.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 p-2 cursor-pointer hover:bg-gray-100 rounded"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => handleSelect(airline)}
                  >
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="font-semibold text-sm">{formattedFlightNumber}</span>
                    </div>
                    <div className="flex flex-col items-end flex-grow min-w-0">
                      <span className="font-medium text-sm truncate w-full text-right">
                        {airline.name} {flightNumber}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </PopoverContent>
      </Popover>

      {/* Airline filter error */}
      {filterError && (
        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-start gap-2">
            <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-900">Error loading airlines</p>
              <p className="text-xs text-red-700 mt-1">{filterError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Flight validation results */}
      {showValidation && pickupDate && validatedFlight && !isValidating && (
        <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-md">
          <div className="flex items-start gap-2">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-green-900">
                  {validatedFlight.flightNumber}
                </p>
                {validatedFlight.isLive !== undefined && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      validatedFlight.isLive
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {validatedFlight.isLive ? "Live" : "Scheduled"}
                  </span>
                )}
              </div>
              <p className="text-xs text-green-700 mt-1">
                {validatedFlight.originIATA || validatedFlight.origin} →{" "}
                {validatedFlight.destinationIATA || validatedFlight.destination}
              </p>
              <p className="text-xs text-green-700">
                Arrives:{" "}
                {new Date(
                  validatedFlight.actualArrival ||
                    validatedFlight.estimatedArrival ||
                    validatedFlight.scheduledArrival,
                ).toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZoneName: "short",
                  timeZone: "Africa/Lagos",
                })}
              </p>
              {validatedFlight.delay && validatedFlight.delay > 0 && (
                <p className="text-xs text-orange-600 mt-1">
                  Delayed by {validatedFlight.delay} minutes
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {showValidation &&
        pickupDate &&
        validationMessage &&
        !isValidating &&
        (() => {
          // Determine if this is an informational message or an actual error
          const isInformational =
            validationMessage.includes("does not fly to Lagos") ||
            validationMessage.includes("already landed") ||
            validationMessage.includes("We only provide");

          const isError =
            validationMessage.includes("not found") ||
            validationMessage.includes("verify the flight number");

          if (isInformational) {
            return (
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <div className="flex items-start gap-2">
                  <Plane className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-blue-900">Notice</p>
                    <p className="text-xs text-blue-700 mt-1">{validationMessage}</p>
                  </div>
                </div>
              </div>
            );
          }

          if (isError) {
            return (
              <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
                <div className="flex items-start gap-2">
                  <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-red-900">Flight not found</p>
                    <p className="text-xs text-red-700 mt-1">{validationMessage}</p>
                  </div>
                </div>
              </div>
            );
          }

          // Default: show as neutral message
          return (
            <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-md">
              <div className="flex items-start gap-2">
                <Plane className="w-5 h-5 text-gray-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-gray-700">{validationMessage}</p>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
