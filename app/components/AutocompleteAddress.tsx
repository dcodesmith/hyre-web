import { Popover, PopoverContent, PopoverTrigger } from "@radix-ui/react-popover";
import { MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "~/lib/utils";
import { Input } from "./ui/input";

const GOOGLE_API_KEY = "AIzaSyC4wP-v71ZBOKNUXx8hOxmuYKdxY2gh0XM";
const GOOGLE_MAPS_SCRIPT_URL = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_API_KEY}&libraries=places`;

interface AutocompleteProps {
  onSelect: (place: google.maps.places.PlaceResult) => void;
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
  placeholder?: string;
  className?: string;
}

export function AutocompleteAddress({
  onSelect,
  inputProps,
  placeholder = "Start typing to search for an address",
  className,
}: AutocompleteProps) {
  const [query, setQuery] = useState<string>("");
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [open, setOpen] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);

  useEffect(() => {
    const loadGoogleMapsScript = () => {
      if (window.google?.maps) {
        initializeServices();
        return;
      }

      const script = document.createElement("script");
      script.src = GOOGLE_MAPS_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.onload = initializeServices;
      document.body.appendChild(script);
    };

    const initializeServices = () => {
      if (!window.google || !window.google.maps) return;

      autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();
      placesServiceRef.current = new window.google.maps.places.PlacesService(
        document.createElement("div"),
      );
    };

    loadGoogleMapsScript();
  }, []);

  const fetchSuggestions = (input: string) => {
    if (!autocompleteServiceRef.current) return;

    // setLoading(true);
    autocompleteServiceRef.current.getPlacePredictions(
      {
        input,
        componentRestrictions: { country: "NG" },
      },
      (predictions) => {
        setSuggestions(predictions || []);
        // setLoading(false);
        setOpen(true);
      },
    );
  };

  const handleSelect = (placeId: string, description: string) => {
    // setQuery(description);
    setQuery("Loading...");
    setOpen(false);

    if (!placesServiceRef.current) return;

    placesServiceRef.current.getDetails({ placeId }, (place) => {
      if (place?.formatted_address) {
        setQuery(
          `${"business_status" in place ? `${place.name},` : ""} ${place.formatted_address.replace(/,?\s+\d{5,6},\s+Lagos,\s+Nigeria$/, "")}`,
        );
        onSelect(place);
      }
      // setLoading(false);
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          onClick={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
          }}
        >
          <Input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              if (event.target.value.length > 2) fetchSuggestions(event.target.value);
              inputProps?.onChange?.(event);
            }}
            placeholder={placeholder}
            className={cn("w-full placeholder-gray-400 rounded", className)}
            autoComplete={inputProps?.autoComplete || "off"}
            {...inputProps}
          />
        </div>
      </PopoverTrigger>
      {open && suggestions.length > 0 && (
        <PopoverContent
          className="w-[--radix-popover-trigger-width] bg-white shadow-md rounded-md p-2 z-50"
          onInteractOutside={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
          }}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
          }}
        >
          <ul>
            {suggestions.map((place) => (
              <li
                key={place.place_id}
                className="flex items-center gap-2 p-2 cursor-pointer hover:bg-gray-100 rounded"
                onClick={() => handleSelect(place.place_id, place.description)}
              >
                <span className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                </span>
                <span>{place.description}</span>
              </li>
            ))}
          </ul>
        </PopoverContent>
      )}
    </Popover>
  );
}
