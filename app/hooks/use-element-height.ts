import { useEffect, useState } from "react";

/** Tracks an element's rendered border-box height with ResizeObserver. */
export function useElementHeight<T extends HTMLElement>() {
  const [element, setElement] = useState<T | null>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (!element) {
      return;
    }

    const updateHeight = () => setHeight(element.offsetHeight);
    const observer = new ResizeObserver(updateHeight);
    updateHeight();
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  return { ref: setElement, height };
}
