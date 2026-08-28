import { SERVICE_TIMEZONE } from "~/time/timezone";

const dateTimeFormatter = new Intl.DateTimeFormat("en-NG", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: SERVICE_TIMEZONE,
});

export function formatFinancialDateTime(value: string | null) {
  return value ? dateTimeFormatter.format(new Date(value)) : "—";
}
