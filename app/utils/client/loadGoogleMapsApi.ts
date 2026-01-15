let loadPromise: Promise<void> | null = null;

/**
 * Lazily load the Google Maps JS SDK on the client.
 * Uses a shared promise to prevent duplicate script injections.
 */
export function loadGoogleMapsApi(apiKey: string, libraries: string[] = ["places"]) {
  if (globalThis.window === undefined) {
    return Promise.resolve();
  }

  // If already loaded, return immediately
  const hasMapsImportLibrary =
    typeof (
      globalThis as typeof globalThis & {
        google?: { maps?: { importLibrary?: () => Promise<unknown> } };
      }
    ).google?.maps?.importLibrary === "function";

  if (hasMapsImportLibrary) {
    return Promise.resolve();
  }

  loadPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    const params = new URLSearchParams({
      key: apiKey,
      v: "weekly",
      libraries: libraries.join(","),
    });

    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loadPromise = null;
      reject(new Error("Failed to load Google Maps JavaScript API"));
    };

    document.head.appendChild(script);
  });

  return loadPromise;
}
