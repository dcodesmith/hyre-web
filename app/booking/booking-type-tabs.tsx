import { BOOKING_TYPE_OPTIONS, BOOKING_TYPE_OPTIONS_MAP, type BookingType } from "~/booking/types";
import { cn } from "~/lib/utils";

interface BookingTypeTabsProps {
  readonly value: BookingType;
  readonly onValueChange: (value: BookingType) => void;
  readonly variant?: "hero" | "modal" | "compact";
}

export function BookingTypeTabs({ value, onValueChange, variant = "hero" }: BookingTypeTabsProps) {
  if (variant === "compact") {
    return (
      <fieldset className="inline-flex h-7 items-center justify-center gap-0.5 rounded-full border-0 bg-gray-100 p-0.5">
        <legend className="sr-only">Booking type</legend>
        {BOOKING_TYPE_OPTIONS.map((type) => {
          const option = BOOKING_TYPE_OPTIONS_MAP[type];
          const isActive = value === type;

          return (
            <button
              key={type}
              type="button"
              data-state={isActive ? "active" : "inactive"}
              aria-pressed={isActive}
              onClick={() => onValueChange(type)}
              className={cn(
                "inline-flex h-6 items-center justify-center rounded-full px-2.5 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isActive && "bg-white shadow-sm",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </fieldset>
    );
  }

  return (
    <fieldset className="w-full">
      <legend className="sr-only">Booking type</legend>
      <div
        className={cn(
          "inline-flex h-auto w-full items-center justify-center rounded-lg p-1",
          variant === "hero"
            ? "border border-white/20 bg-white/10 backdrop-blur-sm"
            : "border border-gray-200 bg-gray-100",
        )}
      >
        {BOOKING_TYPE_OPTIONS.map((type) => {
          const option = BOOKING_TYPE_OPTIONS_MAP[type];
          const isActive = value === type;
          let textColor = "text-white/90";
          if (isActive) {
            textColor = "text-foreground";
          } else if (variant === "modal") {
            textColor = "text-gray-700";
          }

          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isActive}
              onClick={() => onValueChange(type)}
              className={cn(
                "flex min-w-0 flex-1 cursor-pointer flex-col items-center justify-center rounded-md px-1 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isActive && "bg-white",
                !isActive && variant === "hero" && "hover:bg-white/10",
                !isActive && variant === "modal" && "hover:bg-gray-200",
                textColor,
              )}
            >
              <span className="text-sm font-semibold">{option.label}</span>
              <span className="text-xs opacity-80">{option.duration}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
