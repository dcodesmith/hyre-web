import { Loader2, MapPin } from "lucide-react";
import { useId, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { usePlaceAutocomplete } from "~/hooks/use-place-autocomplete";
import { cn } from "~/lib/utils";

const fieldClassName =
  "flex h-10 w-full rounded border border-input bg-transparent px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";
const suggestionButtonClassName =
  "flex w-full items-center gap-2 rounded p-2 text-left text-sm hover:bg-gray-100 focus-visible:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

interface AddressAutocompleteProps {
  readonly id: string;
  readonly value: string;
  readonly onSelect: (address: string) => void;
  readonly placeholder?: string;
  readonly readOnly?: boolean;
}

export function AddressAutocomplete({
  id,
  value,
  onSelect,
  placeholder = "Start typing to search for an address…",
  readOnly = false,
}: AddressAutocompleteProps) {
  const listId = useId();
  const [query, setQuery] = useState(value);
  const [committedValue, setCommittedValue] = useState(value);
  const [open, setOpen] = useState(false);

  if (value !== committedValue) {
    setCommittedValue(value);
    setQuery(value);
  }

  const { suggestions, isLoadingSuggestions, isResolving, resolve } = usePlaceAutocomplete({
    input: query,
    enabled: !readOnly && query.trim().length >= 2,
    onResolved: (address) => {
      setQuery(address);
      setOpen(false);
      onSelect(address);
    },
  });
  const listOpen = open && suggestions.length > 0;

  if (readOnly) {
    return (
      <input
        id={id}
        type="text"
        value={value}
        readOnly
        autoComplete="off"
        spellCheck={false}
        className={cn(fieldClassName, "cursor-not-allowed bg-gray-50")}
      />
    );
  }

  return (
    <Popover open={listOpen} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          <input
            id={id}
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={listOpen}
            aria-controls={listId}
            value={query}
            autoComplete="off"
            spellCheck={false}
            placeholder={placeholder}
            disabled={isResolving}
            onChange={(event) => {
              const next = event.target.value;
              setQuery(next);
              setOpen(next.trim().length >= 2);
              if (next.trim().length === 0) {
                onSelect("");
              }
            }}
            className={fieldClassName}
          />
          {isLoadingSuggestions || isResolving ? (
            <Loader2
              aria-hidden="true"
              className="absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-500"
            />
          ) : null}
        </div>
      </PopoverTrigger>
      <PopoverContent
        id={listId}
        align="start"
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="w-[var(--radix-popover-trigger-width)] p-1"
      >
        {suggestions.map((suggestion) => (
          <button
            key={suggestion.placeId}
            type="button"
            className={suggestionButtonClassName}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setQuery(suggestion.description);
              setOpen(false);
              resolve(suggestion.placeId, suggestion.description);
            }}
          >
            <MapPin aria-hidden="true" className="h-4 w-4 shrink-0 text-gray-500" />
            <span className="min-w-0 break-words">{suggestion.description}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
