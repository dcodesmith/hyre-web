/**
 * Singleton Server-Side Pattern.
 */
export function singleton<Value>(name: string, value: () => Value): Value {
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  const globalStore = global as any;

  globalStore.__singletons ??= {};
  globalStore.__singletons[name] ??= value();

  return globalStore.__singletons[name];
}

// add google map types
declare global {
  interface Window {
    google: {
      maps: {
        // importLibrary: (library: string) => any;
        places: any;
      };
    };
  }
}
