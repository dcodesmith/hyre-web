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

export type FleetCarsView = {
  readonly make: string[];
  readonly model: string[];
  readonly status: FleetCarStatus[];
  readonly page: number;
  readonly pageSize: 10 | 20 | 30 | 40 | 50;
  readonly sortBy: z.output<typeof sortColumnSchema> | null;
  readonly sortDirection: "asc" | "desc";
};

function parseCommaSeparated<T extends string>(
  value: string | null,
  schema: z.ZodType<T>,
  limit: number,
): T[] {
  if (!value) {
    return [];
  }

  const parsedValues: T[] = [];
  for (const item of value.split(",")) {
    const parsed = schema.safeParse(item);
    if (parsed.success && !parsedValues.includes(parsed.data)) {
      parsedValues.push(parsed.data);
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
    make: parseCommaSeparated(searchParams.get("filter.make"), textFilterSchema, 20),
    model: parseCommaSeparated(searchParams.get("filter.model"), textFilterSchema, 20),
    status: parseCommaSeparated(searchParams.get("filter.status"), fleetCarStatusSchema, 4),
    page,
    pageSize,
    sortBy: parsedSortColumn.success ? parsedSortColumn.data : null,
    sortDirection: parsedSortColumn.success && sortDirection === "desc" ? "desc" : "asc",
  };
}

export function serializeFleetCarsView(view: FleetCarsView) {
  const searchParams = new URLSearchParams();

  if (view.make.length > 0) {
    searchParams.set("filter.make", view.make.join(","));
  }
  if (view.model.length > 0) {
    searchParams.set("filter.model", view.model.join(","));
  }
  if (view.status.length > 0) {
    searchParams.set("filter.status", view.status.join(","));
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
