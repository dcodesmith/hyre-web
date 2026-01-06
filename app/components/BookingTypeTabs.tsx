import { cn } from "~/lib/utils";
import { BOOKING_TYPE_OPTIONS, BOOKING_TYPE_OPTIONS_MAP } from "./bookingTypes";

interface BookingTypeTabsProps {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly variant: "compact" | "hero" | "modal";
}

export function BookingTypeTabs({ value, onValueChange, variant }: BookingTypeTabsProps) {
  if (variant === "compact") {
    return (
      <div
        aria-label="Booking type"
        className="inline-flex h-7 items-center justify-center p-0.5 gap-0.5 bg-gray-100 rounded-full"
      >
        {BOOKING_TYPE_OPTIONS.map((type) => {
          const option = BOOKING_TYPE_OPTIONS_MAP[type];
          const isActive = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              data-state={isActive ? "active" : "inactive"}
              className={cn(
                "inline-flex items-center justify-center h-6 px-2.5 text-xs font-medium rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isActive && "bg-white shadow-sm",
              )}
              aria-pressed={isActive}
              onClick={() => onValueChange(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="w-full">
      <div
        aria-label="Booking type"
        className={cn(
          "inline-flex items-center justify-center p-1 w-full h-auto rounded-lg",
          variant === "hero" && "bg-white/10 backdrop-blur-sm border border-white/20",
          variant === "modal" && "bg-gray-100 border border-gray-200",
        )}
      >
        {BOOKING_TYPE_OPTIONS.map((type) => {
          const option = BOOKING_TYPE_OPTIONS_MAP[type];
          const isActive = value === option.value;
          let textColor: string;
          if (isActive) {
            textColor = "text-foreground";
          } else if (variant === "modal") {
            textColor = "text-gray-700";
          } else {
            textColor = "text-white/90";
          }
          return (
            <button
              key={option.value}
              type="button"
              className={cn(
                "flex-1 flex flex-col items-center justify-center min-w-0 py-2 px-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isActive && "bg-white",
                textColor,
              )}
              aria-pressed={isActive}
              onClick={() => onValueChange(option.value)}
            >
              <span className="text-sm font-semibold">{option.label}</span>
              <span className="text-xs opacity-80">{option.duration}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
