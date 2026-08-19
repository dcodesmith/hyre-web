import { useEffect, useRef } from "react";

/**
 * Focuses a DOM node when `shouldFocus` becomes true.
 *
 * DayPicker marks the active day with a `focused` modifier. That is a real
 * browser focus sync, so it lives here instead of in a presentation component.
 */
export function useFocusWhen(shouldFocus: boolean) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (shouldFocus) {
      ref.current?.focus();
    }
  }, [shouldFocus]);

  return ref;
}
