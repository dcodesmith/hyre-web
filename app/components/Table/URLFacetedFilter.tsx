import { CheckIcon } from "@heroicons/react/24/outline";
import { ListFilterIcon } from "lucide-react";
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
import { useSearchParams } from "@remix-run/react";

interface URLFacetedFilterProps {
  title: string;
  paramKey: string;
  options: {
    label: string;
    value: string;
    icon?: React.ComponentType<{ className?: string }>;
  }[];
}

export function URLFacetedFilter({ title, paramKey, options }: URLFacetedFilterProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedValues = new Set((searchParams.get(paramKey) || "").split(",").filter(Boolean));

  const onSelect = (value: string) => {
    const newSearchParams = new URLSearchParams(searchParams);
    const currentValue = searchParams.get(paramKey) || "";
    const values = currentValue ? currentValue.split(",") : [];

    if (selectedValues.has(value)) {
      const newValues = values.filter((v) => v !== value);
      if (newValues.length) {
        newSearchParams.set(paramKey, newValues.join(","));
      } else {
        newSearchParams.delete(paramKey);
      }
    } else {
      values.push(value);
      newSearchParams.set(paramKey, values.join(","));
    }

    setSearchParams(newSearchParams);
  };

  const clearFilters = () => {
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.delete(paramKey);
    setSearchParams(newSearchParams);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="sm:w-auto w-full rounded gap-2 h-10">
          <ListFilterIcon className="h-4 w-4" />
          {title}
          {selectedValues?.size > 0 && (
            <>
              <Separator orientation="vertical" className="mx-2 h-4" />
              <Badge variant="secondary" className="rounded-sm px-1 font-normal lg:hidden">
                {selectedValues.size}
              </Badge>
              <div className="hidden space-x-1 lg:flex">
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
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[200px] p-0" align="start">
        <Command>
          <CommandInput placeholder={`Search ${title}...`} />

          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>

            <CommandGroup>
              {options.map((option) => {
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

                    {option.icon && <option.icon className="mr-2 h-4 w-4 text-muted-foreground" />}

                    <span>{option.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>

            {selectedValues.size > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem onSelect={clearFilters} className="justify-center text-center">
                    Clear filters
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
