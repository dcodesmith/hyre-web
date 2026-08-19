import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import type { SearchFacets } from "~/api/cars/schema";
import { type BookingType, DAY_BOOKING_TYPE } from "~/booking/types";
import { formatNaira } from "~/car/car-domain";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { Skeleton } from "~/components/ui/skeleton";
import { Slider } from "~/components/ui/slider";
import { Switch } from "~/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { useSearchFilterCount } from "~/hooks/use-search-filter-count";
import {
  applySearchFiltersToParams,
  buildSearchPath,
  countActiveSearchFilters,
  emptySearchFilters,
  isServiceTier,
  isVehicleType,
  parseSearchFilters,
  SERVICE_TIERS,
  type SearchFilterValues,
  serviceTierLabels,
  VEHICLE_TYPES,
  vehicleTypeLabels,
} from "~/search/search-url";

const PRICE_UNIT_LABELS: Readonly<Record<BookingType, string>> = {
  DAY: "per day",
  NIGHT: "per night",
  FULL_DAY: "per full day",
  AIRPORT_PICKUP: "per pickup",
};

const CAPACITY_OPTIONS = [4, 5, 6, 7];
const filterToggleGroupClass = "w-full flex-wrap justify-start gap-2 rounded-none";
const filterToggleItemClass =
  "rounded-full px-4 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground";

function getSliderStep(range: number) {
  if (range <= 0) {
    return 1;
  }

  const raw = range / 100;
  const magnitude = 10 ** Math.floor(Math.log10(raw));

  return Math.max(1, Math.ceil(raw / magnitude) * magnitude);
}

interface SearchFiltersProps {
  readonly facets: SearchFacets | null;
  readonly bookingType: BookingType;
  readonly activeFilterCount: number;
}

interface FilterSectionProps {
  readonly title: string;
  readonly children: React.ReactNode;
}

function FilterSection({ title, children }: FilterSectionProps) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

export function SearchFilters({ facets, bookingType, activeFilterCount }: SearchFiltersProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<SearchFilterValues>(emptySearchFilters);
  const { countIsCurrent, resultCount } = useSearchFilterCount({
    open,
    draft,
    searchParams,
  });

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setDraft(parseSearchFilters(searchParams));
    }

    setOpen(nextOpen);
  };

  const handleApply = () => {
    navigate(buildSearchPath(applySearchFiltersToParams(new URLSearchParams(searchParams), draft)));
    setOpen(false);
  };

  const priceBounds = facets && facets.price.max > facets.price.min ? facets.price : null;
  const sliderMin = priceBounds?.min ?? 0;
  const sliderMax = priceBounds?.max ?? 0;
  const sliderStep = getSliderStep(sliderMax - sliderMin);
  const sliderValue: [number, number] = [
    Math.max(sliderMin, Math.min(draft.minPrice ?? sliderMin, sliderMax)),
    Math.min(sliderMax, Math.max(draft.maxPrice ?? sliderMax, sliderMin)),
  ];
  const draftFilterCount = countActiveSearchFilters(draft);
  const priceUnitLabel = PRICE_UNIT_LABELS[bookingType] ?? PRICE_UNIT_LABELS[DAY_BOOKING_TYPE];

  let applyLabel: React.ReactNode = "Show results";

  if (!countIsCurrent) {
    applyLabel = (
      <>
        Show <Skeleton className="h-4 w-6 bg-primary-foreground/30" /> vehicles
      </>
    );
  } else if (resultCount !== undefined) {
    applyLabel = `Show ${resultCount} ${resultCount === 1 ? "vehicle" : "vehicles"}`;
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="relative h-10 gap-2 rounded-full px-4 max-md:size-10 max-md:p-0"
          aria-label="Filters"
        >
          <SlidersHorizontal data-icon="inline-start" />
          <span className="hidden md:inline">Filters</span>
          {activeFilterCount > 0 ? (
            <Badge className="size-5 justify-center rounded-full p-0 text-xs max-md:absolute max-md:-top-1 max-md:-right-1">
              {activeFilterCount}
            </Badge>
          ) : null}
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[85dvh] w-full max-w-full flex-col gap-0 overflow-hidden overscroll-contain rounded-sm border border-neutral-200 bg-white p-0 text-sm text-neutral-950 shadow-lg ring-0 sm:max-w-full sm:rounded-sm md:w-[calc(100%-2rem)] md:max-w-xl">
        <DialogHeader className="gap-0 border-b border-gray-200 px-6 py-4 text-center">
          <DialogTitle className="text-lg leading-none font-semibold tracking-tight">
            Filters
          </DialogTitle>
          <DialogDescription className="sr-only">
            Narrow down vehicles by price, type, service tier, capacity and more.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto overscroll-contain px-6 py-6">
          {priceBounds ? (
            <>
              <FilterSection title={`Price range (${priceUnitLabel})`}>
                <Slider
                  min={sliderMin}
                  max={sliderMax}
                  step={sliderStep}
                  value={sliderValue}
                  onValueChange={([low, high]) =>
                    setDraft((current) => ({
                      ...current,
                      minPrice: low <= sliderMin ? null : low,
                      maxPrice: high >= sliderMax ? null : high,
                    }))
                  }
                  minStepsBetweenThumbs={1}
                  thumbLabels={["Minimum price", "Maximum price"]}
                />
                <div className="flex items-center justify-between text-sm text-gray-600 tabular-nums">
                  <span>{formatNaira(sliderValue[0])}</span>
                  <span>
                    {formatNaira(sliderValue[1])}
                    {sliderValue[1] >= sliderMax ? "+" : ""}
                  </span>
                </div>
              </FilterSection>
              <Separator />
            </>
          ) : null}

          <FilterSection title="Vehicle type">
            <ToggleGroup
              type="multiple"
              variant="outline"
              value={draft.vehicleTypes}
              onValueChange={(values) =>
                setDraft((current) => ({
                  ...current,
                  vehicleTypes: values.filter(isVehicleType),
                }))
              }
              className={filterToggleGroupClass}
            >
              {VEHICLE_TYPES.map((type) => (
                <ToggleGroupItem key={type} value={type} className={filterToggleItemClass}>
                  {vehicleTypeLabels[type]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </FilterSection>

          <Separator />

          <FilterSection title="Service tier">
            <ToggleGroup
              type="multiple"
              variant="outline"
              value={draft.serviceTiers}
              onValueChange={(values) =>
                setDraft((current) => ({
                  ...current,
                  serviceTiers: values.filter(isServiceTier),
                }))
              }
              className={filterToggleGroupClass}
            >
              {SERVICE_TIERS.map((tier) => (
                <ToggleGroupItem key={tier} value={tier} className={filterToggleItemClass}>
                  {serviceTierLabels[tier]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </FilterSection>

          <Separator />

          <FilterSection title="Passengers">
            <ToggleGroup
              type="single"
              variant="outline"
              value={draft.minCapacity === null ? "any" : String(draft.minCapacity)}
              onValueChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  minCapacity: value && value !== "any" ? Number(value) : null,
                }))
              }
              className={filterToggleGroupClass}
            >
              <ToggleGroupItem value="any" className={filterToggleItemClass}>
                Any
              </ToggleGroupItem>
              {CAPACITY_OPTIONS.map((capacity) => (
                <ToggleGroupItem
                  key={capacity}
                  value={String(capacity)}
                  className={filterToggleItemClass}
                >
                  {capacity}+
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </FilterSection>

          {facets && facets.makes.length > 0 ? (
            <>
              <Separator />
              <FilterSection title="Make">
                <div className="grid grid-cols-2 gap-3">
                  {facets.makes.map((make) => (
                    <div key={make.name} className="flex items-center gap-2">
                      <Checkbox
                        id={`make-${make.name}`}
                        checked={draft.makes.some(
                          (item) => item.toLowerCase() === make.name.toLowerCase(),
                        )}
                        onCheckedChange={(checked) =>
                          setDraft((current) => ({
                            ...current,
                            makes:
                              checked === true
                                ? [...current.makes, make.name]
                                : current.makes.filter(
                                    (item) => item.toLowerCase() !== make.name.toLowerCase(),
                                  ),
                          }))
                        }
                        className="border-primary [&_svg]:size-4"
                      />
                      <Label
                        htmlFor={`make-${make.name}`}
                        className="inline flex-1 cursor-pointer font-normal"
                      >
                        {make.name} <span className="text-gray-400">({make.count})</span>
                      </Label>
                    </div>
                  ))}
                </div>
              </FilterSection>
            </>
          ) : null}

          <Separator />

          <FilterSection title="Extras">
            <Label className="flex cursor-pointer items-center justify-between gap-4 font-normal">
              Fuel included in price
              <Switch
                checked={draft.fuelIncluded}
                onCheckedChange={(checked) =>
                  setDraft((current) => ({ ...current, fuelIncluded: checked }))
                }
              />
            </Label>
            <Label className="flex cursor-pointer items-center justify-between gap-4 font-normal">
              On promotion
              <Switch
                checked={draft.dealsOnly}
                onCheckedChange={(checked) =>
                  setDraft((current) => ({ ...current, dealsOnly: checked }))
                }
              />
            </Label>
          </FilterSection>
        </div>

        <div className="flex flex-row items-center justify-between border-t border-gray-200 px-6 py-4">
          <Button
            variant="ghost"
            onClick={() => setDraft(emptySearchFilters())}
            disabled={draftFilterCount === 0}
            className="h-10 rounded-md px-4 underline"
          >
            Clear all
          </Button>
          <Button className="h-10 rounded-md px-4" onClick={handleApply} aria-live="polite">
            {applyLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
