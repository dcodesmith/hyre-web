import { Text } from "@react-email/components";
import { BookingWithRelations } from "~/types";

// Helper for consistently styled list items for details
export function DetailListItem({
  label,
  value,
  isCurrency = false,
  currencyCode = "NGN",
}: {
  label: string;
  value: string | number | undefined | null;
  isCurrency?: boolean;
  currencyCode?: string;
}) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  let displayValue: string | number = value;

  if (isCurrency) {
    displayValue = new Intl.NumberFormat("en-NG", {
      // Consider making locale dynamic if needed
      style: "currency",
      currency: currencyCode,
    }).format(Number(value));
  }

  return (
    <Text className="m-0 py-1">
      {" "}
      {/* Adjusted to text-sm for potentially long lists */}
      <span className="font-semibold">{label}:</span> {displayValue}
    </Text>
  );
}

// Helper to generate a user-friendly name or email
export function getUserDisplayName(
  booking: BookingWithRelations,
  target: "user" | "owner" | "chauffeur" = "user",
): string {
  if (target === "user") {
    return (
      booking.user?.name ||
      booking.user?.username ||
      booking.user?.email ||
      booking.guestUser?.name ||
      booking.guestUser?.email ||
      "Customer"
    );
  }

  if (target === "owner") {
    return (
      booking.car.owner?.name ||
      booking.car.owner?.username ||
      booking.car.owner?.email ||
      "Fleet Owner"
    );
  }

  if (target === "chauffeur" && booking.chauffeur) {
    return booking.chauffeur.name || booking.chauffeur.email || "Chauffeur";
  }

  return "User";
}
