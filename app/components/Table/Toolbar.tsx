import { AdjustmentsVerticalIcon, XCircleIcon } from "@heroicons/react/24/outline";
import { useFetcher, useSearchParams } from "@remix-run/react";
import { Table } from "@tanstack/react-table";
import { format } from "date-fns";
import { useState } from "react";
import { DateRange } from "react-day-picker";
import { Button } from "~/components/ui/button";
import { SerializedCar } from "~/types";
import { DateRangePicker } from "../DateRangePicker";
import { ColumnViewOptions } from "./ColumnViewOptions";
import { FacetedFilter } from "./FacetedFilter";

interface ToolbarProps<TData extends SerializedCar> {
  table: Table<TData>;
  isAdmin?: boolean;
}

export function Toolbar({ table, isAdmin = false }: ToolbarProps<SerializedCar>) {
  const fetcher = useFetcher();
  const [searchParams, setSearchParams] = useSearchParams();
  const isFiltered = table.getState().columnFilters.length > 0;

  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const [dateRange, setDateRange] = useState<DateRange>({
    from: from ? new Date(`${from}T00:00:00`) : undefined,
    to: to ? new Date(`${to}T00:00:00`) : undefined,
  });

  const handleDateRangeChange = (dateRange: DateRange) => {
    setDateRange(dateRange);

    // if (dateRange.from && dateRange.to) {
    const params = new URLSearchParams({
      ...Object.fromEntries(searchParams),
      from: dateRange.from ? format(dateRange.from, "yyyy-MM-dd") : "",
      to: dateRange.to ? format(dateRange.to, "yyyy-MM-dd") : "",
    });

    setSearchParams(params);
    fetcher.load(`?${params.toString()}`);
    // }
  };

  return (
    // sticky top-16 sm:h-16 h-28 z-10 bg-white
    <div className="flex flex-col items-center justify-center gap-2 mt-4 mb-2">
      {/* <div className="flex items-center flex-wrap gap-2"> */}
      {/* <div className="content-center hidden sm:block">
          <AdjustmentsVerticalIcon className="h-5 w-5" />
        </div> */}

      {/* <div className="flex items-center sm:w-auto w-full gap-2 sm:justify-start justify-between"> */}
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

      {isFiltered && (
        <Button
          variant="ghost"
          onClick={() => {
            handleDateRangeChange({ from: undefined, to: undefined });
            table.resetColumnFilters();
            setSearchParams("");
          }}
          className="h-8 px-2 lg:px-3"
        >
          <span className="hidden sm:block">Reset</span>
          <XCircleIcon className="ml-2 h-4 w-4" />
        </Button>
      )}
      {/* </div> */}

      {!isAdmin && (
        <DateRangePicker className="w-64" date={dateRange} onDateChange={handleDateRangeChange} />
      )}
      {/* </div> */}
      {/* {isAdmin && <ColumnViewOptions table={table} />} */}
    </div>
  );
}
