import { SlidersHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFetcher, useNavigate, useSearchParams } from "react-router";

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
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { Slider } from "~/components/ui/slider";
import { Switch } from "~/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import {
  type SearchFacets,
  type SearchFilterValues,
  applySearchFiltersToParams,
  countActiveSearchFilters,
  emptySearchFilters,
  isServiceTier,
  isVehicleType,
  parseSearchFilters,
} from "~/lib/search-filters";
import { formatCurrency } from "~/lib/utils";
import { SERVICE_TIERS, VEHICLE_TYPES, serviceTierLabels, vehicleTypeLabels } from "~/types";

const PRICE_UNIT_LABELS: Record<string, string> = {
  DAY: "per day",
  NIGHT: "per night",
  FULL_DAY: "per full day",
  AIRPORT_PICKUP: "per pickup",
};

const CAPACITY_OPTIONS = [4, 5, 6, 7];

/** Round the slider step to a friendly value based on the price range. */
function getSliderStep(range: number): number {
  if (range <= 0) return 1;
  const raw = range / 100;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  return Math.max(1, Math.ceil(raw / magnitude) * magnitude);
}

interface SearchFiltersProps {
  readonly facets: SearchFacets | null;
  readonly searchBasePath: string;
  readonly bookingType: string;
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

export function SearchFilters({
  facets,
  searchBasePath,
  bookingType,
  activeFilterCount,
}: SearchFiltersProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<SearchFilterValues>(emptySearchFilters);

  const countFetcher = useFetcher<{ pagination?: { total: number } }>();
  const countFetcherRef = useRef(countFetcher);
  useEffect(() => {
    countFetcherRef.current = countFetcher;
  }, [countFetcher]);

  // Debounced live result count while the user adjusts filters
  const [requestedDraftKey, setRequestedDraftKey] = useState<string | null>(null);
  const draftKey = JSON.stringify(draft);
  useEffect(() => {
    if (!open) return;
    const timeout = setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      applySearchFiltersToParams(params, JSON.parse(draftKey) as SearchFilterValues);
      params.set("countOnly", "1");
      setRequestedDraftKey(draftKey);
      countFetcherRef.current.load(`${searchBasePath}?${params.toString()}`);
    }, 300);
    return () => clearTimeout(timeout);
  }, [open, draftKey, searchParams, searchBasePath]);

  // Only show a count that corresponds to the current draft, never a stale one
  const countIsCurrent = countFetcher.state === "idle" && requestedDraftKey === draftKey;
  const resultCount = countIsCurrent ? countFetcher.data?.pagination?.total : undefined;

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setDraft(parseSearchFilters(searchParams));
    }
    setOpen(nextOpen);
  };

  const handleApply = () => {
    const params = new URLSearchParams(searchParams);
    applySearchFiltersToParams(params, draft);
    params.delete("countOnly");
    const query = params.toString();
    navigate(query ? `${searchBasePath}?${query}` : searchBasePath);
    setOpen(false);
  };

  const handleClearAll = () => {
    setDraft(emptySearchFilters());
  };

  // Price slider setup
  const priceBounds = facets && facets.price.max > facets.price.min ? facets.price : null;
  const sliderMin = priceBounds?.min ?? 0;
  const sliderMax = priceBounds?.max ?? 0;
  const sliderStep = getSliderStep(sliderMax - sliderMin);
  const sliderValue: [number, number] = [
    Math.max(sliderMin, Math.min(draft.minPrice ?? sliderMin, sliderMax)),
    Math.min(sliderMax, Math.max(draft.maxPrice ?? sliderMax, sliderMin)),
  ];

  const handlePriceChange = ([low, high]: number[]) => {
    setDraft((prev) => ({
      ...prev,
      minPrice: low <= sliderMin ? null : low,
      maxPrice: high >= sliderMax ? null : high,
    }));
  };

  const toggleMake = (make: string, checked: boolean) => {
    setDraft((prev) => ({
      ...prev,
      makes: checked
        ? [...prev.makes, make]
        : prev.makes.filter((m) => m.toLowerCase() !== make.toLowerCase()),
    }));
  };

  const isMakeSelected = (make: string) =>
    draft.makes.some((m) => m.toLowerCase() === make.toLowerCase());

  const draftFilterCount = countActiveSearchFilters(draft);
  const priceUnitLabel = PRICE_UNIT_LABELS[bookingType] ?? "per day";

  let applyLabel = "Show results";
  if (resultCount !== undefined) {
    const noun = resultCount === 1 ? "vehicle" : "vehicles";
    applyLabel = `Show ${resultCount} ${noun}`;
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="relative gap-2 rounded-full max-md:size-10 max-md:p-0"
          aria-label="Filters"
        >
          <SlidersHorizontal className="size-4" />
          <span className="hidden md:inline">Filters</span>
          {activeFilterCount > 0 && (
            <Badge className="size-5 justify-center rounded-full p-0 text-xs max-md:absolute max-md:-right-1 max-md:-top-1">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[85dvh] w-full max-w-full flex-col gap-0 rounded-sm p-0 sm:rounded-sm md:w-[calc(100%-2rem)] md:max-w-xl">
        <DialogHeader className="border-b border-gray-200 px-6 py-4">
          <DialogTitle>Filters</DialogTitle>
          <DialogDescription className="sr-only">
            Narrow down vehicles by price, type, service tier, capacity and more.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-6">
          {/* Price range */}
          {priceBounds && (
            <>
              <FilterSection title={`Price range (${priceUnitLabel})`}>
                <Slider
                  min={sliderMin}
                  max={sliderMax}
                  step={sliderStep}
                  value={sliderValue}
                  onValueChange={handlePriceChange}
                  minStepsBetweenThumbs={1}
                  thumbLabels={["Minimum price", "Maximum price"]}
                />
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>{formatCurrency(sliderValue[0])}</span>
                  <span>
                    {formatCurrency(sliderValue[1])}
                    {sliderValue[1] >= sliderMax ? "+" : ""}
                  </span>
                </div>
              </FilterSection>
              <Separator />
            </>
          )}

          {/* Vehicle type */}
          <FilterSection title="Vehicle type">
            <ToggleGroup
              type="multiple"
              variant="outline"
              value={draft.vehicleTypes}
              onValueChange={(values) =>
                setDraft((prev) => ({
                  ...prev,
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
          </FilterSection>

          <Separator />

          {/* Service tier */}
          <FilterSection title="Service tier">
            <ToggleGroup
              type="multiple"
              variant="outline"
              value={draft.serviceTiers}
              onValueChange={(values) =>
                setDraft((prev) => ({
                  ...prev,
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
          </FilterSection>

          <Separator />

          {/* Passenger capacity */}
          <FilterSection title="Passengers">
            <ToggleGroup
              type="single"
              variant="outline"
              value={draft.minCapacity === null ? "any" : String(draft.minCapacity)}
              onValueChange={(value) =>
                setDraft((prev) => ({
                  ...prev,
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
          </FilterSection>

          {/* Make */}
          {facets && facets.makes.length > 0 && (
            <>
              <Separator />
              <FilterSection title="Make">
                <div className="grid grid-cols-2 gap-3">
                  {facets.makes.map((make) => (
                    <div key={make.name} className="flex items-center gap-2">
                      <Checkbox
                        id={`make-${make.name}`}
                        checked={isMakeSelected(make.name)}
                        onCheckedChange={(checked) => toggleMake(make.name, checked === true)}
                      />
                      <Label
                        htmlFor={`make-${make.name}`}
                        className="flex-1 cursor-pointer font-normal"
                      >
                        {make.name} <span className="text-gray-400">({make.count})</span>
                      </Label>
                    </div>
                  ))}
                </div>
              </FilterSection>
            </>
          )}

          <Separator />

          {/* Extras */}
          <FilterSection title="Extras">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="filter-fuel-included" className="cursor-pointer font-normal">
                Fuel included in price
              </Label>
              <Switch
                id="filter-fuel-included"
                checked={draft.fuelIncluded}
                onCheckedChange={(checked) =>
                  setDraft((prev) => ({ ...prev, fuelIncluded: checked }))
                }
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="filter-deals-only" className="cursor-pointer font-normal">
                On promotion
              </Label>
              <Switch
                id="filter-deals-only"
                checked={draft.dealsOnly}
                onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, dealsOnly: checked }))}
              />
            </div>
          </FilterSection>
        </div>

        <DialogFooter className="flex-row items-center justify-between border-t border-gray-200 px-6 py-4 sm:justify-between">
          <Button
            variant="ghost"
            onClick={handleClearAll}
            disabled={draftFilterCount === 0}
            className="underline"
          >
            Clear all
          </Button>
          <Button onClick={handleApply}>{applyLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
