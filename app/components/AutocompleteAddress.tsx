import { Popover, PopoverContent, PopoverTrigger } from "@radix-ui/react-popover";
import { MapPin, Loader2 } from "lucide-react";
import { useRef, useState, useEffect, useCallback } from "react";
import { cn } from "~/lib/utils";
import { Input } from "./ui/input";
import useGoogleMapsPlaces from "~/hooks/useGoogleMapsServices"; // Import the hook

interface AutocompleteProps {
  id: string;
  onSelect: (address: string) => void;
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
  placeholder?: string;
  className?: string;
  initialValue?: string;
  countryRestriction?: string; // | string[]; // Allow array for multiple countries
}

export function AutocompleteAddress({
  id,
  onSelect,
  inputProps,
  placeholder = "Start typing to search for an address",
  className,
  initialValue = "",
  countryRestriction = "NG",
}: AutocompleteProps) {
  const [query, setQuery] = useState<string>(initialValue);
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
  const [open, setOpen] = useState<boolean>(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState<boolean>(false);
  const [isFetchingDetails, setIsFetchingDetails] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const { placesApi, isLoading: isLoadingApi, error: apiError } = useGoogleMapsPlaces();

  // Session token for Autocomplete - Important for billing!
  const [sessionToken, setSessionToken] = useState<
    google.maps.places.AutocompleteSessionToken | undefined
  >(undefined);

  // Create a new session token when the input gains focus or query starts
  const createSessionToken = useCallback(() => {
    if (placesApi?.AutocompleteSessionToken) {
      setSessionToken(new placesApi.AutocompleteSessionToken());
    }
  }, [placesApi]);

  useEffect(() => {
    // Create token when component mounts and API is ready
    if (placesApi) createSessionToken();
  }, [placesApi, createSessionToken]);

  // Effect to handle initial value
  useEffect(() => {
    setQuery(initialValue);
  }, [initialValue]);

  const fetchSuggestions = useCallback(
    async (input: string) => {
      if (!placesApi?.AutocompleteSuggestion || isLoadingApi || apiError || input.length < 3) {
        setSuggestions([]);
        setOpen(false);
        return;
      }

      setIsLoadingSuggestions(true);
      setOpen(true);

      const request: google.maps.places.AutocompleteRequest = {
        input,
        sessionToken, // Include session token
        includedRegionCodes: [countryRestriction],
        // lagos state bounds
        locationRestriction: {
          north: 6.695,
          south: 6.4,
          east: 4.06,
          west: 2.72,
        },
      };

      try {
        const { suggestions } =
          await placesApi.AutocompleteSuggestion.fetchAutocompleteSuggestions(request);

        setSuggestions(suggestions || []);
        setOpen(true);
      } catch (error) {
        console.error("Autocomplete prediction failed:", error);
        setSuggestions([]);
        setOpen(false);
      } finally {
        setIsLoadingSuggestions(false);
      }
    },
    [placesApi, isLoadingApi, apiError, countryRestriction, sessionToken],
  );

  const handleSelect = useCallback(
    async (suggestion: google.maps.places.AutocompleteSuggestion) => {
      if (!placesApi?.Place || !suggestion.placePrediction?.placeId) return;

      const description = suggestion.placePrediction.mainText?.text || "";

      setQuery(description); // Update input immediately
      setOpen(false);
      setIsFetchingDetails(true);
      setSuggestions([]);

      try {
        // Create a Place instance using the Place ID
        const place = new placesApi.Place({ id: suggestion.placePrediction.placeId });

        // Fetch required fields - crucial for controlling data and cost
        await place.fetchFields({
          fields: ["displayName", "formattedAddress", "businessStatus"],
        });

        let formattedQuery = place.formattedAddress || description;

        formattedQuery = `${place.businessStatus ? `${place.displayName},` : ""} ${place?.formattedAddress?.replace(/,?\s+\d{5,6},\s+Lagos,\s+Nigeria$/, "")}`;

        setQuery(formattedQuery); // Update input with detailed address
        onSelect(formattedQuery); // Pass back the Place object and string
      } catch (err) {
        console.error("Place details fetch failed:", err);
        // Keep query as the selected description, but pass null for place
        setQuery(description); // Revert query if details fail? Or keep description?
        onSelect(description);
      } finally {
        setIsFetchingDetails(false);
        setOpen(false);
        setSuggestions([]);

        // A new session starts after selecting a place or if the input changes significantly
        createSessionToken(); // Create a new token for the next session
      }
    },
    [placesApi, onSelect, createSessionToken],
  );

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    setQuery(newValue);
    if (!sessionToken && newValue.length > 0) {
      createSessionToken(); // Create token if user starts typing
    }

    if (newValue.length > 2) {
      fetchSuggestions(newValue);
    } else {
      setSuggestions([]);
      setOpen(false);
    }
    inputProps?.onChange?.(event);
  };

  if (apiError) {
    return <div className="text-red-500">Error loading Google Maps: {apiError.message}</div>;
  }

  if (isLoadingApi) {
    return (
      <div className="p-2 text-gray-500 flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading map services...
      </div>
    );
  }

  return (
    <Popover key={id} open={open && suggestions.length > 0} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Input
            ref={inputRef}
            value={query}
            onChange={handleInputChange}
            onFocus={() => {
              if (!sessionToken) {
                createSessionToken();
              }

              if (query.length > 2 && suggestions.length > 0) {
                setOpen(true);
              }
            }}
            placeholder={placeholder}
            className={cn("w-full placeholder-gray-400 rounded", className)}
            autoComplete={inputProps?.autoComplete || "off"}
            disabled={isLoadingApi || isFetchingDetails}
            {...(inputProps ? (({ key: _, ...rest }) => rest)(inputProps as any) : {})}
          />
          {(isLoadingSuggestions || isFetchingDetails) && (
            <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-500" />
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] bg-white shadow-md rounded-md p-2 z-50"
        style={{ width: "var(--radix-popover-trigger-width)" }}
        onOpenAutoFocus={(event) => event.preventDefault()}
        // Consider default closing behavior for onInteractOutside
      >
        <ul>
          {suggestions.map((prediction) => (
            <li
              key={prediction.placePrediction?.placeId}
              className="flex items-center gap-2 p-2 cursor-pointer hover:bg-gray-100 rounded"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => handleSelect(prediction)}
            >
              <MapPin className="w-4 h-4 items-center flex-shrink-0 text-gray-500" />
              <span>{`${prediction.placePrediction?.mainText?.text}, ${prediction.placePrediction?.secondaryText?.text}`}</span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
