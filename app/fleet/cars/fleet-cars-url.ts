import { z } from "zod";

import { type FleetCarStatus, fleetCarStatusSchema } from "~/api/fleet/cars/schema";

const textFilterSchema = z.string().trim().min(1).max(100);
const pageSizeSchema = z.union([
  z.literal(10),
  z.literal(20),
  z.literal(30),
  z.literal(40),
  z.literal(50),
]);
const sortColumnSchema = z.enum([
  "registrationNumber",
  "make",
  "model",
  "year",
  "dayRate",
  "hourlyRate",
  "nightRate",
  "fullDayRate",
  "fuelUpgradeRate",
  "status",
]);
const hideableColumnSchema = z.enum([
  "make",
  "model",
  "year",
  "dayRate",
  "hourlyRate",
  "nightRate",
  "fullDayRate",
  "fuelUpgradeRate",
  "status",
]);

export type FleetCarsView = {
  readonly make: string[];
  readonly model: string[];
  readonly status: FleetCarStatus[];
  readonly hiddenColumns: z.output<typeof hideableColumnSchema>[];
  readonly page: number;
  readonly pageSize: 10 | 20 | 30 | 40 | 50;
  readonly sortBy: z.output<typeof sortColumnSchema> | null;
  readonly sortDirection: "asc" | "desc";
};

function parseRepeated<T extends string>(
  searchParams: URLSearchParams,
  key: string,
  schema: z.ZodType<T>,
  limit: number,
): T[] {
  const parsedValues: T[] = [];
  const parsedValueSet = new Set<T>();
  for (const item of searchParams.getAll(key)) {
    const parsed = schema.safeParse(item);
    if (parsed.success && !parsedValueSet.has(parsed.data)) {
      parsedValues.push(parsed.data);
      parsedValueSet.add(parsed.data);
    }
    if (parsedValues.length === limit) {
      break;
    }
  }

  return parsedValues;
}

export function parseFleetCarsView(searchParams: URLSearchParams): FleetCarsView {
  const page = z.coerce
    .number()
    .int()
    .positive()
    .catch(1)
    .parse(searchParams.get("page") ?? 1);
  const pageSize = pageSizeSchema.catch(10).parse(Number(searchParams.get("pageSize") ?? 10));
  const [sortColumn, sortDirection] = (searchParams.get("sort") ?? "").split(":");
  const parsedSortColumn = sortColumnSchema.safeParse(sortColumn);

  return {
    make: parseRepeated(searchParams, "filter.make", textFilterSchema, 20),
    model: parseRepeated(searchParams, "filter.model", textFilterSchema, 20),
    status: parseRepeated(searchParams, "filter.status", fleetCarStatusSchema, 4),
    hiddenColumns: parseRepeated(searchParams, "column.hidden", hideableColumnSchema, 9),
    page,
    pageSize,
    sortBy: parsedSortColumn.success ? parsedSortColumn.data : null,
    sortDirection: parsedSortColumn.success && sortDirection === "desc" ? "desc" : "asc",
  };
}

export function serializeFleetCarsView(view: FleetCarsView) {
  const searchParams = new URLSearchParams();

  if (view.make.length > 0) {
    for (const make of view.make) {
      searchParams.append("filter.make", make);
    }
  }
  if (view.model.length > 0) {
    for (const model of view.model) {
      searchParams.append("filter.model", model);
    }
  }
  if (view.status.length > 0) {
    for (const status of view.status) {
      searchParams.append("filter.status", status);
    }
  }
  for (const column of view.hiddenColumns) {
    searchParams.append("column.hidden", column);
  }
  if (view.page > 1) {
    searchParams.set("page", String(view.page));
  }
  if (view.pageSize !== 10) {
    searchParams.set("pageSize", String(view.pageSize));
  }
  if (view.sortBy) {
    searchParams.set("sort", `${view.sortBy}:${view.sortDirection}`);
  }

  return searchParams;
}
