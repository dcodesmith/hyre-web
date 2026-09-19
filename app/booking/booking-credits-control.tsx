import { Switch } from "~/components/ui/switch";

export function BookingCreditsControl({
  checked,
  onCheckedChange,
}: {
  readonly checked: boolean;
  readonly onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded border border-blue-200 bg-blue-50 px-4 py-3">
      <label htmlFor="apply-booking-credits" className="text-sm font-semibold text-blue-950">
        Use booking credits
      </label>
      <Switch
        id="apply-booking-credits"
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label="Use booking credits"
      />
    </div>
  );
}
