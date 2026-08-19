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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "~/components/ui/field";
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
          className="relative h-10 gap-2 rounded-full max-md:size-10 max-md:p-0"
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
      <DialogContent className="flex max-h-[85dvh] w-full max-w-full flex-col gap-0 rounded-sm p-0 sm:rounded-sm md:w-[calc(100%-2rem)] md:max-w-xl">
        <DialogHeader className="border-b border-gray-200 px-6 py-4 text-center">
          <DialogTitle className="text-lg font-semibold tracking-tight">Filters</DialogTitle>
          <DialogDescription className="sr-only">
            Narrow down vehicles by price, type, service tier, capacity and more.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup className="flex-1 gap-6 overflow-y-auto px-6 py-6">
          {priceBounds ? (
            <>
              <FieldSet className="gap-3">
                <FieldLegend variant="label" className="mb-0 font-semibold">
                  {`Price range (${priceUnitLabel})`}
                </FieldLegend>
                <Field>
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
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{formatNaira(sliderValue[0])}</span>
                    <span>
                      {formatNaira(sliderValue[1])}
                      {sliderValue[1] >= sliderMax ? "+" : ""}
                    </span>
                  </div>
                </Field>
              </FieldSet>
              <Separator />
            </>
          ) : null}

          <FieldSet className="gap-3">
            <FieldLegend variant="label" className="mb-0 font-semibold">
              Vehicle type
            </FieldLegend>
            <Field>
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
                className="flex-wrap justify-start gap-2"
              >
                {VEHICLE_TYPES.map((type) => (
                  <ToggleGroupItem key={type} value={type} className="rounded-full px-4">
                    {vehicleTypeLabels[type]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>
          </FieldSet>

          <Separator />

          <FieldSet className="gap-3">
            <FieldLegend variant="label" className="mb-0 font-semibold">
              Service tier
            </FieldLegend>
            <Field>
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
                className="flex-wrap justify-start gap-2"
              >
                {SERVICE_TIERS.map((tier) => (
                  <ToggleGroupItem key={tier} value={tier} className="rounded-full px-4">
                    {serviceTierLabels[tier]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>
          </FieldSet>

          <Separator />

          <FieldSet className="gap-3">
            <FieldLegend variant="label" className="mb-0 font-semibold">
              Passengers
            </FieldLegend>
            <Field>
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
                className="flex-wrap justify-start gap-2"
              >
                <ToggleGroupItem value="any" className="rounded-full px-4">
                  Any
                </ToggleGroupItem>
                {CAPACITY_OPTIONS.map((capacity) => (
                  <ToggleGroupItem
                    key={capacity}
                    value={String(capacity)}
                    className="rounded-full px-4"
                  >
                    {capacity}+
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>
          </FieldSet>

          {facets && facets.makes.length > 0 ? (
            <>
              <Separator />
              <FieldSet className="gap-3">
                <FieldLegend variant="label" className="mb-0 font-semibold">
                  Make
                </FieldLegend>
                <FieldGroup className="grid grid-cols-2 gap-3">
                  {facets.makes.map((make) => (
                    <Field key={make.name} orientation="horizontal">
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
                      />
                      <FieldLabel htmlFor={`make-${make.name}`} className="font-normal">
                        {make.name} <span className="text-muted-foreground">({make.count})</span>
                      </FieldLabel>
                    </Field>
                  ))}
                </FieldGroup>
              </FieldSet>
            </>
          ) : null}

          <Separator />

          <FieldSet className="gap-3">
            <FieldLegend variant="label" className="mb-0 font-semibold">
              Extras
            </FieldLegend>
            <FieldGroup className="gap-3">
              <Field orientation="horizontal" className="justify-between">
                <FieldLabel htmlFor="filter-fuel-included" className="font-normal">
                  Fuel included in price
                </FieldLabel>
                <Switch
                  id="filter-fuel-included"
                  checked={draft.fuelIncluded}
                  onCheckedChange={(checked) =>
                    setDraft((current) => ({ ...current, fuelIncluded: checked }))
                  }
                />
              </Field>
              <Field orientation="horizontal" className="justify-between">
                <FieldLabel htmlFor="filter-deals-only" className="font-normal">
                  On promotion
                </FieldLabel>
                <Switch
                  id="filter-deals-only"
                  checked={draft.dealsOnly}
                  onCheckedChange={(checked) =>
                    setDraft((current) => ({ ...current, dealsOnly: checked }))
                  }
                />
              </Field>
            </FieldGroup>
          </FieldSet>
        </FieldGroup>

        <DialogFooter className="mx-0 mb-0 flex-row items-center justify-between rounded-none border-t border-gray-200 bg-transparent px-6 py-4 sm:justify-between">
          <Button
            variant="ghost"
            onClick={() => setDraft(emptySearchFilters())}
            disabled={draftFilterCount === 0}
            className="h-10 underline"
          >
            Clear all
          </Button>
          <Button className="h-10" onClick={handleApply}>
            {applyLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
