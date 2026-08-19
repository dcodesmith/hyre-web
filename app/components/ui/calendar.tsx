import { ChevronDownIcon } from "lucide-react";
import type * as React from "react";
import { type ChevronProps, type DayButton, DayPicker } from "react-day-picker";

import { useFocusWhen } from "~/hooks/use-focus-when";
import { cn } from "~/lib/utils";

const hireAppDayButtonClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-[0.375rem] p-0 text-sm font-normal ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

const hireAppNavButtonClass =
  "inline-flex h-7 w-7 items-center justify-center rounded-[0.375rem] border border-input bg-transparent p-0 opacity-50 hover:bg-accent hover:text-accent-foreground hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

function CalendarRoot({
  className,
  rootRef,
  ...props
}: {
  className?: string;
  rootRef?: React.Ref<HTMLDivElement>;
} & React.ComponentProps<"div">) {
  return <div data-slot="calendar" ref={rootRef} className={cn(className)} {...props} />;
}

function HireAppNavChevron({
  className,
  orientation,
}: {
  readonly className?: string;
  readonly orientation: "left" | "right";
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden="true"
      className={cn("h-4 w-4", className)}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d={orientation === "left" ? "M15.75 19.5 8.25 12l7.5-7.5" : "m8.25 4.5 7.5 7.5-7.5 7.5"}
      />
    </svg>
  );
}

function CalendarChevron({ className, orientation }: ChevronProps) {
  if (orientation === "left" || orientation === "right") {
    return <HireAppNavChevron className={className} orientation={orientation} />;
  }

  return <ChevronDownIcon className={cn("size-4", className)} />;
}

function CalendarWeekNumber({ children, ...props }: React.ComponentProps<"td">) {
  return (
    <td {...props}>
      <div className="flex size-9 items-center justify-center text-center">{children}</div>
    </td>
  );
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  navLayout = "around",
  locale,
  formatters,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("w-fit bg-background p-3", className)}
      captionLayout={captionLayout}
      navLayout={navLayout}
      locale={locale}
      formatters={{
        formatMonthDropdown: (date) => date.toLocaleString(locale?.code, { month: "short" }),
        ...formatters,
      }}
      classNames={{
        months: "flex flex-col space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0",
        month: "relative space-y-4",
        month_caption: "relative flex items-center justify-center pt-1",
        caption_label: "text-sm font-medium",
        nav: "flex items-center space-x-1",
        button_previous: cn(hireAppNavButtonClass, "absolute top-0 left-1"),
        button_next: cn(hireAppNavButtonClass, "absolute top-0 right-1"),
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex",
        weekday: "w-9 rounded-[0.375rem] text-[0.8rem] font-normal text-neutral-500",
        week: "mt-2 flex w-full",
        day: "relative h-9 w-9 p-0 text-center text-sm",
        hidden: "invisible",
        range_start: "[&>button]:rounded-l-md",
        range_middle:
          "[&>button]:rounded-none [&>button]:bg-neutral-100 [&>button]:text-neutral-900",
        range_end: "[&>button]:rounded-r-md",
        ...classNames,
      }}
      components={{
        Root: CalendarRoot,
        Chevron: CalendarChevron,
        DayButton: CalendarDayButton,
        WeekNumber: CalendarWeekNumber,
        ...components,
      }}
      {...props}
    />
  );
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const ref = useFocusWhen(modifiers.focused);

  return (
    <button
      ref={ref}
      type="button"
      data-day={day.date.toLocaleDateString()}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      data-today={modifiers.today}
      className={cn(
        hireAppDayButtonClass,
        className,
        modifiers.today && "bg-neutral-100 text-neutral-900",
        modifiers.selected &&
          "bg-neutral-900 text-neutral-50 hover:bg-neutral-900 hover:text-neutral-50 focus:bg-neutral-900 focus:text-neutral-50",
        modifiers.outside && "text-neutral-500 opacity-50",
        modifiers.disabled && "text-neutral-500 opacity-50",
      )}
      {...props}
    />
  );
}

export { Calendar, CalendarDayButton };
