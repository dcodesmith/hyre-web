import { Table } from "@tanstack/react-table";

import { AdjustmentsHorizontalIcon } from "@heroicons/react/24/outline";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

interface ColumnViewOptionsProps<TData> {
  table: Table<TData>;
}

export function ColumnViewOptions<TData>({ table }: ColumnViewOptionsProps<TData>) {
  return (
    <div className="flex sm:w-auto sm:justify-end w-full">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="rounded gap-2 w-full h-10">
            <AdjustmentsHorizontalIcon className="h-4 w-4" />
            Toggle Columns
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {table
            .getAllColumns()
            .filter((column) => column.getCanHide())
            .map((column) => (
              <DropdownMenuCheckboxItem
                key={column.id}
                className="capitalize"
                checked={column.getIsVisible()}
                onCheckedChange={(value) => column.toggleVisibility(!!value)}
              >
                {column.id}
              </DropdownMenuCheckboxItem>
            ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
