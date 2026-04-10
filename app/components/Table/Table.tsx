import { AdjustmentsVerticalIcon, XCircleIcon } from "@heroicons/react/24/outline";
import {
  type Column,
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Table as TableUI,
} from "~/components/ui/table";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "../ui/drawer";
import { ColumnViewOptions } from "./ColumnViewOptions";
import { FacetedFilter } from "./FacetedFilter";
import { Pagination } from "./Pagination";

/** Stable empty default for `initialSorting` (avoids a new `[]` reference every render). */
const EMPTY_SORTING: SortingState = [];

function facetedFilterOptionsFromColumn<TData, TValue>(column: Column<TData, TValue>) {
  return Array.from(column.getFacetedUniqueValues().keys()).map((value) => ({
    label: String(value),
    value: String(value),
  }));
}

export type TableProps<T extends object> = {
  readonly columns: ColumnDef<T>[];
  readonly data: T[];
  readonly initialSorting?: SortingState;
  readonly hideColumnViewOptions?: boolean;
  readonly action?: React.ReactNode;
};

export function Table<T extends object>({
  columns,
  data,
  initialSorting = EMPTY_SORTING,
  hideColumnViewOptions = false,
  action,
}: TableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>(() =>
    initialSorting.length > 0 ? [...initialSorting] : EMPTY_SORTING,
  );
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      columnFilters,
      pagination,
    },
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedRowModel: getFacetedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),

    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
  });

  const isFiltered = table.getState().columnFilters.length > 0;

  const filterableColumns = table
    .getAllColumns()
    .filter((column) => column.getCanFilter() && column.getFacetedUniqueValues().size > 1);

  const activeFilterCount = columnFilters.filter((f) => {
    const v = f.value;
    if (Array.isArray(v)) return v.length > 0;
    return v !== undefined && v !== null && v !== "";
  }).length;

  return (
    <div className="space-y-4">
      {(table.getFilteredRowModel().rows.length > 0 || action) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-nowrap sm:items-center sm:justify-between">
          <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-1 sm:flex-row sm:items-center sm:gap-2">
            {filterableColumns.length > 0 && (
              <Drawer>
                <DrawerTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 w-full justify-start gap-2 capitalize sm:hidden"
                  >
                    <AdjustmentsVerticalIcon className="h-5 w-5 shrink-0" />
                    <span>Filters</span>
                    {activeFilterCount > 0 ? (
                      <Badge variant="secondary" className="ml-auto rounded-sm px-2 font-normal">
                        {activeFilterCount}
                      </Badge>
                    ) : null}
                  </Button>
                </DrawerTrigger>
                <DrawerContent className="max-h-[85vh]">
                  <DrawerHeader className="text-left">
                    <DrawerTitle>Filters</DrawerTitle>
                  </DrawerHeader>
                  <div className="flex max-h-[min(60vh,28rem)] flex-col gap-4 overflow-y-auto px-4 pb-2">
                    {filterableColumns.map((column) => (
                      <FacetedFilter
                        key={column.id}
                        column={column}
                        title={column.id}
                        variant="inline"
                        options={facetedFilterOptionsFromColumn(column)}
                      />
                    ))}
                  </div>
                  <DrawerFooter className="flex-row gap-2 pt-2">
                    {isFiltered ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={() => table.resetColumnFilters()}
                      >
                        Clear all
                      </Button>
                    ) : null}
                    <DrawerClose asChild>
                      <Button type="button" className={isFiltered ? "flex-1" : "w-full"}>
                        Done
                      </Button>
                    </DrawerClose>
                  </DrawerFooter>
                </DrawerContent>
              </Drawer>
            )}

            {filterableColumns.length > 0 && (
              <div className="hidden min-w-0 flex-1 flex-row flex-wrap items-center gap-2 sm:flex">
                <AdjustmentsVerticalIcon className="h-5 w-5 shrink-0" aria-hidden />
                <div className="flex min-w-0 flex-1 flex-row flex-wrap items-center gap-2">
                  {filterableColumns.map((column) => (
                    <FacetedFilter
                      key={column.id}
                      column={column}
                      title={column.id}
                      options={facetedFilterOptionsFromColumn(column)}
                    />
                  ))}
                </div>
              </div>
            )}

            {isFiltered && (
              <Button
                variant="ghost"
                onClick={() => table.resetColumnFilters()}
                className="hidden h-8 px-2 sm:inline-flex lg:px-3"
              >
                <span>Reset</span>
                <XCircleIcon className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="flex w-full items-center justify-end gap-2 sm:ml-auto sm:w-auto">
            {!hideColumnViewOptions && <ColumnViewOptions table={table} />}
            {action}
          </div>
        </div>
      )}

      <div className="rounded border">
        <TableUI className="border-gray-400 w-full border-collapse">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="px-0">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() ? "selected" : undefined}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="border-b-gray-400">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </TableUI>
      </div>

      {data.length >= 10 ? <Pagination table={table} /> : null}
    </div>
  );
}
