import { CheckIcon, ChevronsUpDownIcon, SearchIcon } from "lucide-react";
import { useId, useState } from "react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { FieldLegend, FieldSet } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/lib/utils";

export type FleetCarsFilterOption = {
  readonly value: string;
  readonly label: string;
  readonly count: number;
};

type FleetCarsFilterProps = {
  readonly title: string;
  readonly options: FleetCarsFilterOption[];
  readonly selectedValues: readonly string[];
  readonly onToggle: (value: string) => void;
  readonly inline?: boolean;
};

function FilterOptions({ title, options, selectedValues, onToggle, inline }: FleetCarsFilterProps) {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleOptions =
    normalizedQuery.length === 0
      ? options
      : options.filter((option) => option.label.toLocaleLowerCase().includes(normalizedQuery));

  return (
    <FieldSet className={cn("gap-3", inline && "rounded-lg border p-3")}>
      {inline ? (
        <div className="flex items-center justify-between gap-3">
          <FieldLegend variant="label" className="mb-0 capitalize">
            {title}
          </FieldLegend>
          {selectedValues.length > 0 ? (
            <Badge variant="secondary" className="rounded-sm font-normal">
              {selectedValues.length} selected
            </Badge>
          ) : null}
        </div>
      ) : null}

      {options.length > 7 ? (
        <div className="relative">
          <Label htmlFor={inputId} className="sr-only">
            Search {title}
          </Label>
          <SearchIcon
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id={inputId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder={`Search ${title}`}
            className="h-9 pl-9"
          />
        </div>
      ) : null}

      <div className="max-h-60 space-y-1 overflow-y-auto">
        {visibleOptions.length > 0 ? (
          visibleOptions.map((option) => {
            const checked = selectedValues.includes(option.value);

            return (
              <Button
                key={option.value}
                type="button"
                role="checkbox"
                aria-checked={checked}
                variant="ghost"
                onClick={() => onToggle(option.value)}
                className="flex min-h-9 w-full justify-start gap-2 rounded-md px-2 py-1.5 font-normal"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-sm border border-primary",
                    checked ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible",
                  )}
                >
                  <CheckIcon className="size-3" />
                </span>
                <span className="min-w-0 flex-1 truncate text-left">{option.label}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{option.count}</span>
              </Button>
            );
          })
        ) : (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            No {title.toLocaleLowerCase()} found.
          </p>
        )}
      </div>
    </FieldSet>
  );
}

export function FleetCarsFilter(props: FleetCarsFilterProps) {
  const { title, options, selectedValues, onToggle, inline = false } = props;
  const [isOpen, setIsOpen] = useState(false);

  if (inline) {
    return <FilterOptions {...props} inline />;
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 min-w-36 max-w-72 justify-start rounded-md capitalize"
        >
          {title}
          {selectedValues.length > 0 ? (
            <>
              <Separator orientation="vertical" className="mx-2 h-4" />
              <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                {selectedValues.length > 2
                  ? `${selectedValues.length} selected`
                  : selectedValues
                      .map((value) => options.find((option) => option.value === value)?.label)
                      .filter(Boolean)
                      .join(", ")}
              </Badge>
            </>
          ) : null}
          <ChevronsUpDownIcon aria-hidden="true" className="ml-auto size-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-3">
        <FilterOptions
          title={title}
          options={options}
          selectedValues={selectedValues}
          onToggle={onToggle}
        />
      </PopoverContent>
    </Popover>
  );
}
