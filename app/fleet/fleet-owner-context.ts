import { createContext } from "react-router";

import type { FleetOwnerOnboarding } from "~/api/fleet/onboarding/schema";
import type { requireFleetOwner } from "~/auth/fleet-owner-session.server";

export type FleetOwnerRequestContext = {
  readonly onboarding: FleetOwnerOnboarding;
  readonly user: Awaited<ReturnType<typeof requireFleetOwner>>;
};

export const fleetOwnerContext = createContext<FleetOwnerRequestContext>();
