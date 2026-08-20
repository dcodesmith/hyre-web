import type { SearchFlight } from "~/api/flights/schema";
import { formatFlightArrivalSummary } from "~/booking/airport-pickup";
import { Label } from "~/components/ui/label";

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
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="block font-semibold">
        Flight Number
      </Label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={(event) => onBlur(event.target.value)}
        placeholder="e.g. BA123…"
        autoComplete="off"
        spellCheck={false}
        aria-invalid={error != null}
        aria-describedby={showStatus ? statusId : undefined}
        className="flex h-10 w-full rounded border border-input bg-transparent px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
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
        <p id={statusId} className="text-xs text-gray-600" aria-live="polite">
          {formatFlightArrivalSummary(flight)}
          {warning ? ` · ${warning}` : ""}
        </p>
      ) : null}
    </div>
  );
}
