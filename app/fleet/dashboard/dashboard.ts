import type { DashboardGroupBy } from "~/api/fleet/dashboard/schema";

const dayFormatter = new Intl.DateTimeFormat("en-NG", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const monthFormatter = new Intl.DateTimeFormat("en-NG", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function formatEarningsBucket(bucketStart: string, groupBy: DashboardGroupBy) {
  const date = new Date(bucketStart);

  if (groupBy === "month") {
    return monthFormatter.format(date);
  }

  const formattedDate = dayFormatter.format(date);
  return groupBy === "week" ? `Week of ${formattedDate}` : formattedDate;
}
