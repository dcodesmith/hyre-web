import { createElement, type ReactNode } from "react";
import type { DateRange } from "react-day-picker";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DAY_BOOKING_TYPE } from "~/booking/types";

const dialogOpenState = vi.hoisted(() => ({
  forceOpen: false,
  setOpen: vi.fn(),
}));

vi.mock("react", async (importOriginal) => {
  const React = await importOriginal<typeof import("react")>();

  return {
    ...React,
    useState: (initial: unknown) => {
      const state = React.useState(initial);
      if (dialogOpenState.forceOpen && initial === false) {
        return [true, dialogOpenState.setOpen];
      }

      return state;
    },
  };
});

vi.mock("~/components/ui/dialog", () => ({
  Dialog: ({ children }: { children?: ReactNode }) =>
    createElement("div", { "data-slot": "dialog" }, children),
  DialogTrigger: ({ asChild, children }: { asChild?: boolean; children?: ReactNode }) =>
    asChild && children ? children : createElement("button", { type: "button" }, children),
  DialogContent: ({ children }: { children?: ReactNode }) =>
    createElement("div", { "data-slot": "dialog-content" }, children),
  DialogTitle: ({ children }: { children?: ReactNode }) => createElement("h2", null, children),
  DialogClose: ({ children }: { children?: ReactNode }) =>
    createElement("button", { type: "button" }, children),
}));

type CalendarProps = {
  readonly mode?: string;
  readonly onSelect?: (value: DateRange | Date | undefined) => void;
};

let capturedCalendar: CalendarProps | undefined;

vi.mock("~/components/ui/calendar", () => ({
  Calendar: (props: CalendarProps) => {
    capturedCalendar = props;
    return createElement("div", { "data-calendar": props.mode ?? "unknown" });
  },
}));

import { SearchDateRangePicker, SearchSingleDatePicker } from "~/search/search-date-picker";

const fromDate = new Date("2026-08-20T10:00:00+01:00");
const toDate = new Date("2026-08-21T10:00:00+01:00");

describe("search date pickers", () => {
  beforeEach(() => {
    capturedCalendar = undefined;
    dialogOpenState.forceOpen = false;
    dialogOpenState.setOpen.mockReset();
  });

  it("wires the range trigger to When / Add dates and dialog field labels", () => {
    const markup = renderToStaticMarkup(
      createElement(SearchDateRangePicker, {
        bookingType: DAY_BOOKING_TYPE,
        fromDate: undefined,
        toDate: undefined,
        onRangeChange: vi.fn(),
      }),
    );

    expect(markup).toContain("When");
    expect(markup).toContain("Add dates");
    expect(markup).toContain("Start date");
    expect(markup).toContain("End date");
    expect(markup).not.toContain('data-calendar="range"');
  });

  it("shows a formatted range on the trigger when dates are selected", () => {
    const markup = renderToStaticMarkup(
      createElement(SearchDateRangePicker, {
        bookingType: DAY_BOOKING_TYPE,
        fromDate,
        toDate,
        onRangeChange: vi.fn(),
      }),
    );

    expect(markup).toContain("Aug 20 - 21");
    expect(markup).not.toContain("Add dates");
  });

  it("wires the single-date trigger to When / Add date", () => {
    const markup = renderToStaticMarkup(
      createElement(SearchSingleDatePicker, {
        bookingType: DAY_BOOKING_TYPE,
        date: undefined,
        onDateChange: vi.fn(),
      }),
    );

    expect(markup).toContain("When");
    expect(markup).toContain("Add date");
    expect(markup).not.toContain('data-calendar="single"');
  });

  it("mounts the range calendar only while the dialog is open", () => {
    dialogOpenState.forceOpen = true;

    const markup = renderToStaticMarkup(
      createElement(SearchDateRangePicker, {
        bookingType: DAY_BOOKING_TYPE,
        fromDate: undefined,
        toDate: undefined,
        onRangeChange: vi.fn(),
      }),
    );

    expect(markup).toContain('data-calendar="range"');
    expect(capturedCalendar?.mode).toBe("range");
  });

  it("forwards range selection and closes only after an end date is chosen", () => {
    const onRangeChange = vi.fn();
    dialogOpenState.forceOpen = true;

    renderToStaticMarkup(
      createElement(SearchDateRangePicker, {
        bookingType: DAY_BOOKING_TYPE,
        fromDate: undefined,
        toDate: undefined,
        onRangeChange,
      }),
    );

    capturedCalendar?.onSelect?.(undefined);
    expect(onRangeChange).toHaveBeenCalledWith(undefined, undefined);

    capturedCalendar?.onSelect?.({ from: fromDate, to: fromDate });
    expect(onRangeChange).toHaveBeenLastCalledWith(fromDate, undefined);
    expect(dialogOpenState.setOpen).not.toHaveBeenCalledWith(false);

    capturedCalendar?.onSelect?.({ from: fromDate, to: toDate });
    expect(onRangeChange).toHaveBeenLastCalledWith(fromDate, toDate);
    expect(dialogOpenState.setOpen).toHaveBeenCalledWith(false);
  });

  it("starts a fresh range when editing completed dates", () => {
    const onRangeChange = vi.fn();
    const laterDate = new Date("2026-08-24T10:00:00+01:00");
    dialogOpenState.forceOpen = true;

    renderToStaticMarkup(
      createElement(SearchDateRangePicker, {
        bookingType: DAY_BOOKING_TYPE,
        fromDate,
        toDate,
        onRangeChange,
      }),
    );

    capturedCalendar?.onSelect?.({ from: fromDate, to: laterDate });
    expect(onRangeChange).toHaveBeenCalledWith(laterDate, undefined);
    expect(dialogOpenState.setOpen).not.toHaveBeenCalledWith(false);
  });

  it("forwards single-date selection and closes after a date is chosen", () => {
    const onDateChange = vi.fn();
    dialogOpenState.forceOpen = true;

    renderToStaticMarkup(
      createElement(SearchSingleDatePicker, {
        bookingType: DAY_BOOKING_TYPE,
        date: undefined,
        onDateChange,
      }),
    );

    capturedCalendar?.onSelect?.(fromDate);
    expect(onDateChange).toHaveBeenCalledWith(fromDate);
    expect(dialogOpenState.setOpen).toHaveBeenCalledWith(false);
  });
});
