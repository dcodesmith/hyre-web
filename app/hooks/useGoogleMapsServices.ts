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
    let retryCount = 0;
    const maxRetries = 3;

    const initializePlacesApi = async () => {
      try {
        // Wait for Google Maps to be available
        const waitForGoogleMaps = () => {
          return new Promise<void>((resolve, reject) => {
            const checkGoogleMaps = () => {
              if (window.google?.maps && typeof window.google.maps.importLibrary === "function") {
                resolve();
              } else if (retryCount < maxRetries) {
                retryCount++;
                setTimeout(checkGoogleMaps, 500); // Check every 500ms
              } else {
                reject(new Error("Google Maps API not available after retries"));
              }
            };
            checkGoogleMaps();
          });
        };

        await waitForGoogleMaps();

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
