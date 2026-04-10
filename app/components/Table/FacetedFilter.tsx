import { CheckIcon } from "@heroicons/react/24/outline";
import { Column } from "@tanstack/react-table";
import { ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { Badge } from "../ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "../ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Separator } from "../ui/separator";

interface FacetedFilterProps<TData, TValue> {
  column?: Column<TData, TValue>;
  title?: string;
  options: {
    label: string;
    value: string;
    icon?: React.ComponentType<{ className?: string }>;
  }[];
  /** `inline` renders the filter list without a popover (e.g. inside a mobile drawer). */
  variant?: "popover" | "inline";
}

type FacetedFilterPanelProps<TData, TValue> = Readonly<{
  title?: string;
  options: FacetedFilterProps<TData, TValue>["options"];
  facets: ReturnType<Column<TData, TValue>["getFacetedUniqueValues"]>;
  selectedValues: Set<string>;
  onSelect: (value: string) => void;
  onClearColumn: () => void;
}>;

function FacetedFilterPanel<TData, TValue>({
  title,
  options,
  facets,
  selectedValues,
  onSelect,
  onClearColumn,
}: FacetedFilterPanelProps<TData, TValue>) {
  return (
    <Command>
      <CommandInput className="capitalize" placeholder={title} />

      <CommandList>
        <CommandEmpty>No {title} found.</CommandEmpty>

        <CommandGroup>
          {options
            .filter((option) => !facets || (facets.get(option.value) ?? 0) > 0)
            .map((option) => {
              const isSelected = selectedValues.has(option.value);

              return (
                <CommandItem key={option.value} onSelect={() => onSelect(option.value)}>
                  <div
                    className={cn(
                      "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "opacity-50 [&_svg]:invisible",
                    )}
                  >
                    <CheckIcon className={cn("h-4 w-4")} />
                  </div>

                  {option.icon ? (
                    <option.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                  ) : null}

                  <span>{option.label}</span>

                  {facets?.get(option.value) ? (
                    <span className="ml-auto flex h-4 w-4 items-center justify-center text-xs">
                      ({facets.get(option.value)})
                    </span>
                  ) : null}
                </CommandItem>
              );
            })}
        </CommandGroup>

        {selectedValues.size > 0 ? (
          <>
            <CommandSeparator />

            <CommandGroup>
              <CommandItem onSelect={onClearColumn} className="justify-center text-center">
                Clear filters
              </CommandItem>
            </CommandGroup>
          </>
        ) : null}
      </CommandList>
    </Command>
  );
}

export function FacetedFilter<TData, TValue>({
  column,
  title,
  options,
  variant = "popover",
}: Readonly<FacetedFilterProps<TData, TValue>>) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);

  if (!column) return null;

  const facets = column.getFacetedUniqueValues();
  const selectedValues = new Set(column.getFilterValue() as string[]);

  const onSelect = (value: string) => {
    if (selectedValues.has(value)) {
      selectedValues.delete(value);
    } else {
      selectedValues.add(value);
    }

    const filterValues = Array.from(selectedValues);

    // Only set filter if we have values, otherwise clear it
    if (filterValues.length) {
      column.setFilterValue(filterValues);
      searchParams.set(`filter.${column.id}`, filterValues.join(","));
    } else {
      column.setFilterValue(undefined);
      searchParams.delete(`filter.${column.id}`);
    }
    setSearchParams(searchParams);
  };

  const onClearColumn = () => {
    column.setFilterValue(undefined);
    searchParams.delete(`filter.${column.id}`);
    setSearchParams(searchParams);
  };

  if (variant === "inline") {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium capitalize">{title}</span>
          {selectedValues.size > 0 ? (
            <Badge variant="secondary" className="shrink-0 rounded-sm px-2 font-normal">
              {selectedValues.size} selected
            </Badge>
          ) : null}
        </div>
        <div className="overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-sm">
          <FacetedFilterPanel
            title={title}
            options={options}
            facets={facets}
            selectedValues={selectedValues}
            onSelect={onSelect}
            onClearColumn={onClearColumn}
          />
        </div>
      </div>
    );
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          onClick={() => setIsOpen(!isOpen)}
          variant="outline"
          size="sm"
          className="h-10 min-w-[9rem] max-w-[18rem] shrink-0 justify-start gap-2 rounded capitalize"
        >
          {title}
          {selectedValues.size > 0 ? (
            <>
              <Separator orientation="vertical" className="mx-2 h-4" />
              <Badge variant="secondary" className="rounded-sm px-1 font-normal sm:hidden">
                {selectedValues.size}
              </Badge>
              <div className="hidden space-x-1 sm:flex">
                {selectedValues.size > 2 ? (
                  <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                    {selectedValues.size} selected
                  </Badge>
                ) : (
                  options
                    .filter((option) => selectedValues.has(option.value))
                    .map((option) => (
                      <Badge
                        variant="secondary"
                        key={option.value}
                        className="rounded-sm px-1 font-normal"
                      >
                        {option.label}
                      </Badge>
                    ))
                )}
              </div>
            </>
          ) : null}
          {isOpen ? (
            <ChevronsDownUp className="h-4 w-4 ml-auto" />
          ) : (
            <ChevronsUpDown className="h-4 w-4 ml-auto" />
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-96 p-0" align="start">
        <FacetedFilterPanel
          title={title}
          options={options}
          facets={facets}
          selectedValues={selectedValues}
          onSelect={onSelect}
          onClearColumn={onClearColumn}
        />
      </PopoverContent>
    </Popover>
  );
}
