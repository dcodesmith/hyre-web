import {
  AdjustmentsVerticalIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { useFetcher, useSearchParams } from "@remix-run/react";
import { Table } from "@tanstack/react-table";
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

export function Toolbar({
  table,
  isAdmin = false,
}: ToolbarProps<SerializedCar>) {
  const fetcher = useFetcher();
  const [searchParams, setSearchParams] = useSearchParams();
  const isFiltered = table.getState().columnFilters.length > 0;

  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const [dateRange, setDateRange] = useState<DateRange>({
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
  });

  const handleDateRangeChange = (dateRange: DateRange) => {
    setDateRange(dateRange);

    // if (dateRange.from && dateRange.to) {
    const params = new URLSearchParams({
      ...Object.fromEntries(searchParams),
      from: dateRange.from ? dateRange.from.toISOString().split("T")[0] : "",
      to: dateRange.to ? dateRange.to.toISOString().split("T")[0] : "",
    });

    setSearchParams(params);
    fetcher.load(`?${params.toString()}`);
    // }
  };

  return (
    <div className="flex items-center justify-between sticky top-[78px] z-10 bg-white">
      <div className="flex items-center flex-wrap gap-2">
        <div className="content-center hidden sm:block">
          <AdjustmentsVerticalIcon className="h-5 w-5" />
        </div>

        <div className="flex items-center sm:w-auto w-full gap-2 sm:justify-start justify-between">
          {table.getColumn("make") && (
            <FacetedFilter
              column={table.getColumn("make")}
              title="Make"
              options={Array.from(
                table.getColumn("make")?.getFacetedUniqueValues().keys() ?? []
              ).map((value) => ({
                label: String(value),
                value: String(value),
              }))}
            />
          )}

          {table.getColumn("model") && (
            <FacetedFilter
              column={table.getColumn("model")}
              title="Model"
              options={Array.from(
                table.getColumn("model")?.getFacetedUniqueValues().keys() ?? []
              ).map((value) => ({
                label: String(value),
                value: String(value),
              }))}
            />
          )}

          {/* {isAdmin && table.getColumn("status") && (
            <FacetedFilter
              column={table.getColumn("status")}
              title="Status"
              options={statuses.map((status) => ({
                label: status,
                value: status,
              }))}
            />
          )} */}

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
        </div>

        {!isAdmin && (
          <DateRangePicker
            className="sm:w-[277px]"
            date={dateRange}
            onDateChange={handleDateRangeChange}
          />
        )}
      </div>
      {isAdmin && <ColumnViewOptions table={table} />}
    </div>
  );
}
