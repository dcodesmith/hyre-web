import { Analytics } from "@vercel/analytics/remix";
import { SpeedInsights } from "@vercel/speed-insights/react";

/**
 * Analytics wrapper component that is lazy-loaded
 * This component is separated to enable code splitting via React.lazy
 */
export function AnalyticsWrapper() {
  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
