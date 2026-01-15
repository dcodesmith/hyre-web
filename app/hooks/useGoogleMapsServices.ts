import { useEffect, useState } from "react";
import { loadGoogleMapsApi } from "~/utils/client/loadGoogleMapsApi";

// const GOOGLE_API_KEY = "AIzaSyC4wP-v71ZBOKNUXx8hOxmuYKdxY2gh0XM";

type PlacesApiType = Awaited<ReturnType<typeof google.maps.importLibrary>> & {
  AutocompleteSuggestion: typeof google.maps.places.AutocompleteSuggestion;
  Place: typeof google.maps.places.Place;
  AutocompleteSessionToken: typeof google.maps.places.AutocompleteSessionToken;
};

const useGoogleMapsPlaces = () => {
  const [placesApi, setPlacesApi] = useState<PlacesApiType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;
    const initializePlacesApi = async () => {
      try {
        const apiKey = globalThis.window?.ENV?.GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
          throw new Error("Missing Google Maps API key");
        }

        await loadGoogleMapsApi(apiKey, ["places"]);

        if (!isMounted) return;

        const places = (await google.maps.importLibrary("places")) as PlacesApiType;

        if (isMounted) {
          setPlacesApi(places);
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Failed to load Google Maps Places library:", error);
        if (isMounted) {
          setError(error instanceof Error ? error : new Error(String(error)));
          setIsLoading(false);
        }
      }
    };

    initializePlacesApi();

    return () => {
      isMounted = false;
    };
  }, []);

  return { placesApi, isLoading, error };
};

export default useGoogleMapsPlaces;
