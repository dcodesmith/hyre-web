import type { FleetOwnerOnboarding } from "~/api/fleet/onboarding/schema";

export function fleetOwnerRoleLabel(
  onboarding: Pick<FleetOwnerOnboarding, "accountType" | "isOwnerDriver">,
) {
  if (onboarding.isOwnerDriver) {
    return "Owner-driver";
  }

  if (onboarding.accountType === "BUSINESS") {
    return "Business";
  }

  return "Individual";
}
