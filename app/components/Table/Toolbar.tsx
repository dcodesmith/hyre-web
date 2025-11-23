import { XCircleIcon } from "@heroicons/react/24/outline";
import { useSearchParams } from "@remix-run/react";
import { Table } from "@tanstack/react-table";
import { format } from "date-fns";
import { useState } from "react";
import { DateRange } from "react-day-picker";
import { Button } from "~/components/ui/button";
import { SerializedCar } from "~/types";
import { DateRangePicker } from "../booking/DateRangePicker";

import { FacetedFilter } from "./FacetedFilter";

interface ToolbarProps<TData extends SerializedCar> {
  readonly table: Table<TData>;
  readonly isAdmin?: boolean;
}

export function Toolbar({ table, isAdmin = false }: ToolbarProps<SerializedCar>) {
  const [searchParams, setSearchParams] = useSearchParams();
  const isFiltered = table.getState().columnFilters.length > 0;

  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const [dateRange, setDateRange] = useState<DateRange>({
    from: from ? new Date(`${from}T00:00:00`) : undefined,
    to: to ? new Date(`${to}T00:00:00`) : undefined,
  });

  const hasDateRange = Boolean(
    searchParams.get("from") || searchParams.get("to") || dateRange.from || dateRange.to,
  );
  const showReset = isFiltered || hasDateRange;

  const handleDateRangeChange = (dateRange: DateRange) => {
    setDateRange(dateRange);

    // Create a new URLSearchParams object (don't modify the existing one)
    const newSearchParams = new URLSearchParams(searchParams);

    if (dateRange.from && dateRange.to) {
      newSearchParams.set("from", format(dateRange.from, "yyyy-MM-dd"));
      newSearchParams.set("to", format(dateRange.to, "yyyy-MM-dd"));
    } else {
      newSearchParams.delete("from");
      newSearchParams.delete("to");
    }

    // Update the URL (this will re-run the loader)
    setSearchParams(newSearchParams, { replace: true, preventScrollReset: true });
  };

  return (
    <div className="flex flex-col items-center justify-center gap-2 mt-4 mb-2">
      {table.getColumn("make") && (
        <div className="w-64">
          <FacetedFilter
            column={table.getColumn("make")}
            title="Select make"
            options={Array.from(table.getColumn("make")?.getFacetedUniqueValues().keys() ?? []).map(
              (value) => ({
                label: String(value),
                value: String(value),
              }),
            )}
          />
        </div>
      )}

      {table.getColumn("model") && (
        <div className="w-64">
          <FacetedFilter
            column={table.getColumn("model")}
            title="Select model"
            options={Array.from(
              table.getColumn("model")?.getFacetedUniqueValues().keys() ?? [],
            ).map((value) => ({
              label: String(value),
              value: String(value),
            }))}
          />
        </div>
      )}

      {!isAdmin && (
        <DateRangePicker
          className="w-64"
          date={dateRange}
          onDateChange={handleDateRangeChange}
          singleDateMode={false}
          alwaysAllowToday
        />
      )}

      {showReset ? (
        <Button
          variant="ghost"
          onClick={() => {
            setDateRange({ from: undefined, to: undefined });
            table.resetColumnFilters();
            setSearchParams(new URLSearchParams(), { replace: true, preventScrollReset: true });
          }}
          className="h-8 px-2 lg:px-3"
        >
          <span className="hidden sm:block">Clear filters</span>
          <XCircleIcon className="ml-2 h-4 w-4" />
        </Button>
      ) : (
        <div
          className="h-8 px-2 lg:px-3 inline-flex items-center invisible select-none"
          aria-hidden="true"
        />
      )}
    </div>
  );
}
