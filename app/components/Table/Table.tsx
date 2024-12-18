import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  Table as TableUI,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Pagination } from "./Pagination";
import { FacetedFilter } from "./FacetedFilter";
import {
  AdjustmentsVerticalIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { Button } from "../ui/button";
import { ColumnViewOptions } from "./ColumnViewOptions";

type TableProps<T extends object> = {
  columns: ColumnDef<T>[];
  data: T[];
};

const rowVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

export function Table<T extends object>({ columns, data }: TableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
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
    .filter(
      (column) =>
        column.getCanFilter() && column.getFacetedUniqueValues().size > 1
    );

  return (
    <div className="space-y-4">
      {table.getFilteredRowModel().rows.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center flex-wrap gap-2">
            {filterableColumns.length > 0 && (
              <div className="content-center hidden sm:block">
                <AdjustmentsVerticalIcon className="h-5 w-5" />
              </div>
            )}

            <div className="flex items-center sm:w-auto w-full gap-2 sm:justify-start justify-between">
              <div className="flex gap-2 flex-wrap">
                {filterableColumns.map((column) => (
                  <FacetedFilter
                    key={column.id}
                    column={column}
                    title={column.id}
                    options={Array.from(
                      column.getFacetedUniqueValues().keys()
                    ).map((value) => ({
                      label: String(value),
                      value: String(value),
                    }))}
                  />
                ))}
              </div>

              {isFiltered && (
                <Button
                  variant="ghost"
                  onClick={() => table.resetColumnFilters()}
                  className="h-8 px-2 lg:px-3"
                >
                  <span className="hidden sm:block">Reset</span>
                  <XCircleIcon className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <ColumnViewOptions table={table} />
        </div>
      )}

      <div className="rounded border">
        <TableUI className="border-gray-400 w-full border-collapse">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          {/* <motion.tbody> */}
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                // <motion.div
                //   key={row.id}
                //   variants={rowVariants}
                //   initial="hidden"
                //   animate="visible"
                //   exit="exit"
                //   transition={{ duration: 0.3 }}
                // >
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="border-b-gray-400">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
                // </motion.div>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          {/* </motion.tbody> */}
        </TableUI>
      </div>

      <Pagination table={table} />
    </div>
  );
}
