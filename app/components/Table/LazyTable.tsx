import type { ComponentType } from "react";
import { Suspense, lazy } from "react";
import type { TableProps } from "./Table";

const Table = lazy<
  (<T extends object>(props: TableProps<T>) => JSX.Element) & {
    displayName?: string;
  }
>(() => import("./Table").then((mod) => ({ default: mod.Table })));

export function LazyTable<T extends object>(props: Readonly<TableProps<T>>) {
  const TableComponent = Table as unknown as ComponentType<TableProps<T>>;

  return (
    <Suspense
      fallback={
        <output className="p-4 text-sm text-gray-500" aria-live="polite">
          Loading table…
        </output>
      }
    >
      <TableComponent {...props} />
    </Suspense>
  );
}
