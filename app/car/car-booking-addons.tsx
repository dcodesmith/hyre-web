import type { PublicAddon } from "~/api/addons/schema";
import { Checkbox } from "~/components/ui/checkbox";
import { formatCurrency } from "~/money/currency";

export function CarBookingAddons({
  addons,
  selectedIds,
  onSelectionChange,
}: {
  readonly addons: PublicAddon[];
  readonly selectedIds: readonly string[];
  readonly onSelectionChange: (addonId: string, selected: boolean) => void;
}) {
  return (
    <section
      aria-labelledby="booking-addons-heading"
      className="mt-4 lg:mt-0 lg:border-t lg:bg-gray-50 lg:px-6 lg:py-4"
    >
      <h3 id="booking-addons-heading" className="mb-2 text-sm font-semibold">
        Add-ons
      </h3>
      <div className="space-y-3 rounded border border-neutral-200 bg-white px-4 py-4 shadow-xl inset-shadow-sm transform-gpu lg:rounded-none lg:border-none lg:bg-transparent lg:px-0 lg:py-0 lg:shadow-none lg:inset-shadow-none">
        {addons.map((addon) => {
          const inputId = `booking-addon-${addon.id}`;
          const selected = selectedIds.includes(addon.id);

          return (
            <div key={addon.id} className="flex items-start gap-3">
              <Checkbox
                id={inputId}
                name="addonIds"
                value={addon.id}
                checked={selected}
                disabled={!selected && selectedIds.length >= 10}
                className="mt-0.5"
                onCheckedChange={(checked) => onSelectionChange(addon.id, checked === true)}
              />
              <label htmlFor={inputId} className="min-w-0 flex-1 cursor-pointer">
                <span className="flex justify-between gap-3 text-sm leading-5">
                  <span className="min-w-0 wrap-break-words font-medium">{addon.name}</span>
                  <span className="shrink-0 font-medium tabular-nums">
                    {formatCurrency(addon.unitPrice, addon.currency)}
                  </span>
                </span>
                {addon.description ? (
                  <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">
                    {addon.description}
                  </span>
                ) : null}
              </label>
            </div>
          );
        })}
      </div>
    </section>
  );
}
