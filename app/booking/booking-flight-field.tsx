import { useId, useState } from "react";

import type { SearchFlight } from "~/api/flights/schema";
import {
  type Airline,
  extractFlightDigits,
  filterAirlines,
  formatAirlineFlight,
} from "~/booking/airlines";
import { formatFlightRoute, formatLagosClock } from "~/booking/airport-pickup";
import { Label } from "~/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";

interface FlightNumberAutocompleteProps {
  readonly id?: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onBlur?: (value: string) => void;
  readonly className?: string;
  readonly placeholder?: string;
  readonly "aria-invalid"?: boolean;
  readonly "aria-describedby"?: string;
}

interface BookingFlightFieldProps {
  readonly id: string;
  readonly value: string;
  readonly flight: SearchFlight | null;
  readonly error: string | null;
  readonly warning: string | null;
  readonly isValidating: boolean;
  readonly onChange: (value: string) => void;
  readonly onBlur: (value: string) => void;
}

export function FlightNumberAutocomplete({
  id,
  value,
  onChange,
  onBlur,
  className,
  placeholder = "e.g. BA74, DL54…",
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: FlightNumberAutocompleteProps) {
  const generatedId = useId();
  const listId = `${id ?? generatedId}-suggestions`;
  const [open, setOpen] = useState(false);
  const suggestions = filterAirlines(value);
  const listOpen = open && suggestions.length > 0;

  const handleSelect = (airline: Airline) => {
    const next = formatAirlineFlight(airline, extractFlightDigits(value, airline));
    setOpen(false);
    onChange(next);
    onBlur?.(next);
  };

  return (
    <Popover open={listOpen} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <input
          id={id}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={listOpen}
          aria-controls={listId}
          value={value}
          onChange={(event) => {
            const next = event.target.value;
            onChange(next);
            setOpen(next.trim().length >= 2);
          }}
          onBlur={(event) => onBlur?.(event.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          className={className}
        />
      </PopoverTrigger>
      <PopoverContent
        id={listId}
        align="start"
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="w-[var(--radix-popover-trigger-width)] p-1"
      >
        {suggestions.map((airline) => {
          const digits = extractFlightDigits(value, airline);
          const flightNumber = formatAirlineFlight(airline, digits);

          return (
            <button
              key={airline.id}
              type="button"
              className="flex w-full items-center justify-between gap-3 rounded p-2 text-left text-sm hover:bg-gray-100 focus-visible:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => handleSelect(airline)}
            >
              <span className="font-semibold">{flightNumber}</span>
              <span className="min-w-0 truncate text-right text-gray-600">
                {airline.name}
                {digits ? ` ${digits}` : ""}
              </span>
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

export function BookingFlightField({
  id,
  value,
  flight,
  error,
  warning,
  isValidating,
  onChange,
  onBlur,
}: BookingFlightFieldProps) {
  const statusId = `${id}-status`;
  const showStatus = Boolean(isValidating || error || (flight && !error));

  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="block font-semibold leading-5">
        Flight Number
      </Label>
      <FlightNumberAutocomplete
        id={id}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        aria-invalid={error != null}
        aria-describedby={showStatus ? statusId : undefined}
        className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
      />
      {isValidating ? (
        <p id={statusId} className="text-xs text-gray-600" aria-live="polite">
          Checking flight…
        </p>
      ) : null}
      {error ? (
        <p id={statusId} className="text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {flight && !error ? (
        <div
          id={statusId}
          className="mt-0 rounded-sm border border-green-200 bg-green-50 p-2"
          aria-live="polite"
        >
          <div className="flex items-start gap-2 text-xs text-green-700">
            <span>{formatFlightRoute(flight)}</span>
            <span>{formatLagosClock(flight.arrivalTime)}</span>
          </div>
          {warning ? <p className="mt-1 text-xs text-orange-600">{warning}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
