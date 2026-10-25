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
    <section aria-labelledby="booking-addons-heading">
      <h3 id="booking-addons-heading" className="mb-2 text-sm leading-5">
        <span className="font-semibold">Add-ons </span>
        <span className="font-normal">(optional)</span>
      </h3>
      <div className="space-y-3 rounded-lg border border-gray-200 px-3 py-4">
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
                  <span className="mt-0.5 block text-sm leading-6 text-gray-900">
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
