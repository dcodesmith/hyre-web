import { Analytics } from "@vercel/analytics/remix";
import { SpeedInsights } from "@vercel/speed-insights/react";

/**
 * Analytics wrapper component that is lazy-loaded
 * This component is separated to enable code splitting via React.lazy
 * Only renders on Vercel deployments
 */
export function AnalyticsWrapper() {
  // Only load Vercel analytics when deployed to Vercel
  if (import.meta.env.VITE_VERCEL !== "1") {
    return null;
  }

  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
