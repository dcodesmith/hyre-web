import { useEffect } from "react";
import { useRevalidator } from "react-router";

/** Revalidates the current route loader while mounted, and only while the revalidator is idle. */
export function useRevalidateInterval(intervalMs: number) {
  const { revalidate, state } = useRevalidator();

  useEffect(() => {
    if (state !== "idle") {
      return;
    }

    const interval = window.setInterval(() => {
      void revalidate();
    }, intervalMs);
    return () => window.clearInterval(interval);
  }, [intervalMs, revalidate, state]);
}
