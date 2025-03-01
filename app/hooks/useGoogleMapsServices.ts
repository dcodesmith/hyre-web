import { useEffect, useRef } from "react";

const GOOGLE_API_KEY = "AIzaSyC4wP-v71ZBOKNUXx8hOxmuYKdxY2gh0XM";
const GOOGLE_MAPS_SCRIPT_URL = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_API_KEY}&libraries=places`;

const useGoogleMapsServices = () => {
  const isScriptLoaded = useRef(false);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);

  useEffect(() => {
    const initializeServices = () => {
      if (!window.google || !window.google.maps) return;

      autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();
      placesServiceRef.current = new window.google.maps.places.PlacesService(
        document.createElement("div"),
      );
    };

    const loadGoogleMapsScript = () => {
      if (isScriptLoaded.current) return; // Prevent multiple script loads
      if (window.google?.maps) {
        initializeServices();
        return;
      }

      isScriptLoaded.current = true;
      console.log("Loading Google Maps script");

      const script = document.createElement("script");
      script.src = GOOGLE_MAPS_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.onload = initializeServices;
      document.body.appendChild(script);
    };

    loadGoogleMapsScript();
  }, []);

  return { autocompleteServiceRef, placesServiceRef };
};

export default useGoogleMapsServices;
