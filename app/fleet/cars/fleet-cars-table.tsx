import {
  type ColumnFiltersState,
  type ColumnVisibilityState,
  functionalUpdate,
  type PaginationState,
  type ReactTable,
  type SortingState,
  useTable,
} from "@tanstack/react-table";
import {
  ChevronFirstIcon,
  ChevronLastIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Columns3Icon,
  RotateCcwIcon,
  SlidersHorizontalIcon,
} from "lucide-react";
import { useSearchParams } from "react-router";

import type { FleetCar, FleetCarStatus } from "~/api/fleet/cars/schema";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { getFleetCarStatusLabel } from "./fleet-car";
import { FleetCarsFilter, type FleetCarsFilterOption } from "./fleet-cars-filter";
import { fleetCarsColumns } from "./fleet-cars-table-columns";
import { type FleetCarsTableFeatures, fleetCarsTableFeatures } from "./fleet-cars-table-features";
import { type FleetCarsView, parseFleetCarsView, serializeFleetCarsView } from "./fleet-cars-url";

const PAGE_SIZES = [10, 20, 30, 40, 50] as const;
const HIDEABLE_COLUMN_IDS = [
  "make",
  "model",
  "year",
  "dayRate",
  "hourlyRate",
  "nightRate",
  "fullDayRate",
  "fuelUpgradeRate",
  "status",
] as const satisfies readonly FleetCarsView["hiddenColumns"][number][];

const COLUMN_LABELS: Readonly<Record<string, string>> = {
  registrationNumber: "Registration",
  make: "Make",
  model: "Model",
  year: "Year",
  dayRate: "Day rate",
  hourlyRate: "Hourly rate",
  nightRate: "Night rate",
  fullDayRate: "Full day rate",
  fuelUpgradeRate: "Fuel upgrade",
  status: "Status",
};

type TableFilterProps = {
  readonly title: string;
  readonly options: FleetCarsFilterOption[];
  readonly field: "make" | "model" | "status";
  readonly selectedValues: readonly string[];
};

function textOptions(cars: readonly FleetCar[], key: "make" | "model") {
  const counts = new Map<string, number>();
  for (const car of cars) {
    const value = car[key];
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return Array.from(counts, ([value, count]) => ({ value, label: value, count })).sort(
    (left, right) => left.label.localeCompare(right.label),
  );
}

function statusOptions(cars: readonly FleetCar[]): FleetCarsFilterOption[] {
  const counts = new Map<FleetCarStatus, number>();
  for (const car of cars) {
    counts.set(car.status, (counts.get(car.status) ?? 0) + 1);
  }

  return Array.from(counts, ([value, count]) => ({
    value,
    label: getFleetCarStatusLabel(value),
    count,
  })).sort((left, right) => left.label.localeCompare(right.label));
}

function columnFiltersFromView(view: FleetCarsView): ColumnFiltersState {
  const filters: ColumnFiltersState = [];
  if (view.make.length > 0) {
    filters.push({ id: "make", value: view.make });
  }
  if (view.model.length > 0) {
    filters.push({ id: "model", value: view.model });
  }
  if (view.status.length > 0) {
    filters.push({ id: "status", value: view.status });
  }
  return filters;
}

function toggleSelectedValue(values: readonly string[], value: string) {
  return values.includes(value)
    ? values.filter((selectedValue) => selectedValue !== value)
    : [...values, value];
}

function TablePagination({
  table,
}: {
  readonly table: ReactTable<FleetCarsTableFeatures, FleetCar>;
}) {
  return (
    <div className="flex flex-col gap-3 px-2 py-2 sm:flex-row sm:items-center sm:justify-end sm:gap-6">
      <div className="flex items-center justify-between gap-2 sm:justify-start">
        <span className="text-sm text-muted-foreground">Rows per page</span>
        <Select
          value={String(table.state.pagination.pageSize)}
          onValueChange={(value) => table.setPageSize(Number(value))}
        >
          <SelectTrigger className="h-8 w-18">
            <SelectValue />
          </SelectTrigger>
          <SelectContent side="top">
            {PAGE_SIZES.map((pageSize) => (
              <SelectItem key={pageSize} value={String(pageSize)}>
                {pageSize}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-medium tabular-nums">
          Page {table.state.pagination.pageIndex + 1} of {Math.max(table.getPageCount(), 1)}
        </span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.setPageIndex(0)}
          >
            <span className="sr-only">Go to first page</span>
            <ChevronFirstIcon aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          >
            <span className="sr-only">Go to previous page</span>
            <ChevronLeftIcon aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
          >
            <span className="sr-only">Go to next page</span>
            <ChevronRightIcon aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="hidden sm:inline-flex"
            disabled={!table.getCanNextPage()}
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
          >
            <span className="sr-only">Go to last page</span>
            <ChevronLastIcon aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function useFleetCarsTable(cars: FleetCar[]) {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = parseFleetCarsView(searchParams);
  const columnFilters = columnFiltersFromView(view);
  const columnVisibility: ColumnVisibilityState = Object.fromEntries(
    view.hiddenColumns.map((columnId) => [columnId, false]),
  );
  const sorting: SortingState = view.sortBy
    ? [{ id: view.sortBy, desc: view.sortDirection === "desc" }]
    : [];
  const pagination: PaginationState = {
    pageIndex: view.page - 1,
    pageSize: view.pageSize,
  };

  const updateView = (nextView: FleetCarsView) => {
    setSearchParams(serializeFleetCarsView(nextView), {
      replace: true,
      preventScrollReset: true,
    });
  };

  const table = useTable({
    features: fleetCarsTableFeatures,
    data: cars,
    columns: fleetCarsColumns,
    autoResetPageIndex: false,
    state: {
      columnFilters,
      columnVisibility,
      pagination,
      sorting,
    },
    onColumnVisibilityChange: (updater) => {
      const next = functionalUpdate(updater, columnVisibility);
      updateView({
        ...view,
        hiddenColumns: HIDEABLE_COLUMN_IDS.filter((columnId) => next[columnId] === false),
      });
    },
    onPaginationChange: (updater) => {
      const next = functionalUpdate(updater, pagination);
      updateView({
        ...view,
        page: next.pageIndex + 1,
        pageSize: PAGE_SIZES.includes(next.pageSize as (typeof PAGE_SIZES)[number])
          ? (next.pageSize as FleetCarsView["pageSize"])
          : 10,
      });
    },
    onSortingChange: (updater) => {
      const next = functionalUpdate(updater, sorting)[0];
      updateView({
        ...view,
        page: 1,
        sortBy: (next?.id as FleetCarsView["sortBy"]) ?? null,
        sortDirection: next?.desc ? "desc" : "asc",
      });
    },
  });

  const setFilterValues = (field: "make" | "model" | "status", values: string[]) => {
    updateView({
      ...view,
      make: field === "make" ? values : view.make,
      model: field === "model" ? values : view.model,
      page: 1,
      status: field === "status" ? (values as FleetCarStatus[]) : view.status,
    });
  };

  const clearFilters = () => {
    updateView({
      ...view,
      make: [],
      model: [],
      page: 1,
      status: [],
    });
  };

  return { clearFilters, setFilterValues, table, view };
}

export function FleetCarsTable({ cars }: { readonly cars: FleetCar[] }) {
  const { clearFilters, setFilterValues, table, view } = useFleetCarsTable(cars);
  const makeOptions = textOptions(cars, "make");
  const modelOptions = textOptions(cars, "model");
  const carStatusOptions = statusOptions(cars);
  const activeFilterCount = table.state.columnFilters.length;

  const availableFilters: TableFilterProps[] = [
    {
      title: "Make",
      options: makeOptions,
      field: "make",
      selectedValues: view.make,
    },
    {
      title: "Model",
      options: modelOptions,
      field: "model",
      selectedValues: view.model,
    },
    {
      title: "Status",
      options: carStatusOptions,
      field: "status",
      selectedValues: view.status,
    },
  ];
  const filterProps = availableFilters.filter(
    ({ options, selectedValues }) => options.length > 1 || selectedValues.length > 0,
  );
  const hideableColumns = table.getAllColumns().filter((column) => column.getCanHide());

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        {filterProps.length > 0 ? (
          <>
            <Sheet>
              <SheetTrigger asChild>
                <Button type="button" variant="outline" className="w-full justify-start sm:hidden">
                  <SlidersHorizontalIcon aria-hidden="true" />
                  Filters
                  {activeFilterCount > 0 ? (
                    <Badge variant="secondary" className="ml-auto rounded-sm font-normal">
                      {activeFilterCount}
                    </Badge>
                  ) : null}
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="max-h-[85svh] rounded-t-xl">
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                <div className="space-y-4 overflow-y-auto px-4 pb-4">
                  {filterProps.map(({ title, options, field, selectedValues }) => (
                    <FleetCarsFilter
                      key={title}
                      title={title}
                      options={options}
                      selectedValues={selectedValues}
                      onToggle={(value) =>
                        setFilterValues(field, toggleSelectedValue(selectedValues, value))
                      }
                      inline
                    />
                  ))}
                </div>
                <SheetFooter className="flex-row">
                  {activeFilterCount > 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={clearFilters}
                    >
                      Clear all
                    </Button>
                  ) : null}
                  <SheetClose asChild>
                    <Button type="button" className="flex-1">
                      Done
                    </Button>
                  </SheetClose>
                </SheetFooter>
              </SheetContent>
            </Sheet>

            <div className="hidden flex-wrap items-center gap-2 sm:flex">
              <SlidersHorizontalIcon
                aria-hidden="true"
                className="size-5 shrink-0 text-muted-foreground"
              />
              {filterProps.map(({ title, options, field, selectedValues }) => (
                <FleetCarsFilter
                  key={title}
                  title={title}
                  options={options}
                  selectedValues={selectedValues}
                  onToggle={(value) =>
                    setFilterValues(field, toggleSelectedValue(selectedValues, value))
                  }
                />
              ))}
              {activeFilterCount > 0 ? (
                <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                  Reset
                  <RotateCcwIcon aria-hidden="true" />
                </Button>
              ) : null}
            </div>
          </>
        ) : (
          <div />
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" className="w-full sm:w-auto">
              <Columns3Icon aria-hidden="true" />
              Toggle columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {hideableColumns.map((column) => (
              <DropdownMenuCheckboxItem
                key={column.id}
                checked={column.getIsVisible()}
                onCheckedChange={(checked) => column.toggleVisibility(Boolean(checked))}
              >
                {COLUMN_LABELS[column.id] ?? column.id}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="overflow-hidden rounded-md border">
        <Table>
          <caption className="sr-only">Cars in your fleet</caption>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="h-11 whitespace-nowrap px-2">
                    {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="whitespace-nowrap">
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={table.getVisibleLeafColumns().length}
                  className="h-28 text-center"
                >
                  {table.state.pagination.pageIndex > 0
                    ? "No cars on this page."
                    : "No cars match the selected filters."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {table.getPageCount() > 1 || table.state.pagination.pageIndex > 0 ? (
        <TablePagination table={table} />
      ) : null}
    </div>
  );
}
