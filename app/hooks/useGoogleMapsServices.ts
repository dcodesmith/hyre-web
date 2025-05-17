import { useEffect, useState } from "react";

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
        if (window.google?.maps && typeof window.google.maps.importLibrary === "function") {
          const places = (await google.maps.importLibrary("places")) as PlacesApiType;
          setPlacesApi(places);
          setIsLoading(false);
        } else {
          console.error("Google Maps API or importLibrary not available.");
          setError(new Error("Google Maps API or importLibrary not available."));
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
