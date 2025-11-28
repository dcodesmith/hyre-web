// Shared account type constants and mappings

export const FLEET_OWNER_TYPE = "fleetOwner" as const;
export const OWNER_DRIVER_TYPE = "ownerDriver" as const;

export const ACCOUNT_TYPE_OPTIONS = [FLEET_OWNER_TYPE, OWNER_DRIVER_TYPE] as const;

export type AccountType = (typeof ACCOUNT_TYPE_OPTIONS)[number];

export const ACCOUNT_TYPE_OPTIONS_MAP = {
  [FLEET_OWNER_TYPE]: {
    label: "Fleet Owner",
    description: "Manage multiple vehicles",
    value: FLEET_OWNER_TYPE,
  },
  [OWNER_DRIVER_TYPE]: {
    label: "Owner-Driver",
    description: "Drive my own vehicle",
    value: OWNER_DRIVER_TYPE,
  },
} as const;
