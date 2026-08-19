import { ChevronDownIcon } from "lucide-react";
import type * as React from "react";
import { type DayButton, DayPicker, getDefaultClassNames, type Locale } from "react-day-picker";

import { Button } from "~/components/ui/button";
import { useFocusWhen } from "~/hooks/use-focus-when";
import { cn } from "~/lib/utils";

const hireAppNavButtonClass =
  "inline-flex size-7 items-center justify-center rounded-md border border-input bg-transparent p-0 text-sm font-medium opacity-50 ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50";

const hireAppDayButtonClass =
  "inline-flex size-9 items-center justify-center rounded-md p-0 text-sm font-normal ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 aria-selected:opacity-100";

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
      className={cn("size-4", className)}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d={orientation === "left" ? "M15.75 19.5 8.25 12l7.5-7.5" : "m8.25 4.5 7.5 7.5-7.5 7.5"}
      />
    </svg>
  );
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  buttonVariant: _buttonVariant = "outline",
  locale,
  formatters,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>["variant"];
}) {
  const defaultClassNames = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        "group/calendar w-fit bg-background p-3 [--cell-radius:0.375rem] [--cell-size:--spacing(9)]",
        String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
        String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
        className,
      )}
      captionLayout={captionLayout}
      navLayout="around"
      locale={locale}
      formatters={{
        formatMonthDropdown: (date) => date.toLocaleString(locale?.code, { month: "short" }),
        ...formatters,
      }}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn(defaultClassNames.months, "relative flex flex-col sm:flex-row sm:gap-4"),
        month: cn(defaultClassNames.month, "relative flex w-fit flex-col gap-4"),
        nav: cn(
          defaultClassNames.nav,
          "absolute inset-x-0 top-1 flex items-center justify-between",
        ),
        button_previous: cn(
          defaultClassNames.button_previous,
          hireAppNavButtonClass,
          "absolute top-0 left-1",
        ),
        button_next: cn(
          defaultClassNames.button_next,
          hireAppNavButtonClass,
          "absolute top-0 right-1",
        ),
        month_caption: cn(
          defaultClassNames.month_caption,
          "relative flex h-auto items-center justify-center px-0 pt-1",
        ),
        dropdowns: cn(
          defaultClassNames.dropdowns,
          "flex h-7 items-center justify-center gap-1.5 text-sm font-medium",
        ),
        dropdown_root: cn(defaultClassNames.dropdown_root, "relative rounded-md"),
        dropdown: cn(defaultClassNames.dropdown, "absolute inset-0 bg-popover opacity-0"),
        caption_label: cn(
          defaultClassNames.caption_label,
          "text-sm font-medium select-none",
          captionLayout === "label"
            ? undefined
            : "flex items-center gap-1 rounded-md [&>svg]:size-3.5 [&>svg]:text-muted-foreground",
        ),
        month_grid: cn(defaultClassNames.month_grid, "w-full border-collapse"),
        weekdays: cn(defaultClassNames.weekdays, "flex"),
        weekday: cn(
          defaultClassNames.weekday,
          "h-auto w-9 flex-none rounded-md text-[0.8rem] font-normal text-neutral-500 select-none",
        ),
        week: cn(defaultClassNames.week, "mt-2 flex w-full"),
        week_number_header: cn(defaultClassNames.week_number_header, "w-9 select-none"),
        week_number: cn(
          defaultClassNames.week_number,
          "text-[0.8rem] text-neutral-500 select-none",
        ),
        day: cn(
          defaultClassNames.day,
          "group/day relative size-9 p-0 text-center text-sm select-none",
        ),
        range_start: cn(defaultClassNames.range_start, "[&>button]:rounded-l-md"),
        range_middle: cn(
          defaultClassNames.range_middle,
          "[&>button]:rounded-none [&>button]:bg-neutral-100 [&>button]:text-neutral-900",
        ),
        range_end: cn(defaultClassNames.range_end, "[&>button]:rounded-r-md"),
        today: cn(defaultClassNames.today, "bg-transparent"),
        outside: cn(defaultClassNames.outside, "bg-transparent opacity-100"),
        disabled: cn(defaultClassNames.disabled, "bg-transparent opacity-100"),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Root: ({ className, rootRef, ...props }) => (
          <div data-slot="calendar" ref={rootRef} className={cn(className)} {...props} />
        ),
        Chevron: ({ className, orientation }) => {
          if (orientation === "left" || orientation === "right") {
            return <HireAppNavChevron className={className} orientation={orientation} />;
          }

          return <ChevronDownIcon className={cn("size-4", className)} />;
        },
        DayButton: ({ ...props }) => <CalendarDayButton locale={locale} {...props} />,
        WeekNumber: ({ children, ...props }) => (
          <td {...props}>
            <div className="flex size-9 items-center justify-center text-center">{children}</div>
          </td>
        ),
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
  locale,
  ...props
}: React.ComponentProps<typeof DayButton> & { locale?: Partial<Locale> }) {
  const ref = useFocusWhen(modifiers.focused);

  return (
    <button
      ref={ref}
      type="button"
      data-day={day.date.toLocaleDateString(locale?.code)}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      data-today={modifiers.today}
      className={cn(
        hireAppDayButtonClass,
        modifiers.today && "bg-neutral-100 text-neutral-900",
        modifiers.selected &&
          "bg-neutral-900 text-neutral-50 hover:bg-neutral-900 hover:text-neutral-50 focus:bg-neutral-900 focus:text-neutral-50",
        modifiers.outside && "text-neutral-500 opacity-50",
        modifiers.disabled && "text-neutral-500 opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Calendar, CalendarDayButton };
