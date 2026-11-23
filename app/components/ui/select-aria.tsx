"use client";

import { cn } from "cn";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import * as React from "react";
import {
  Button as ButtonPrimitive,
  composeRenderProps,
  ListBoxItem as ListBoxItemPrimitive,
  ListBox as ListBoxPrimitive,
  Popover as PopoverPrimitive,
  Select as SelectPrimitive,
  SelectValue as SelectValuePrimitive,
} from "react-aria-components";

function Select({ className, ...props }: React.ComponentProps<typeof SelectPrimitive>) {
  return <SelectPrimitive data-slot="select" className={cn("w-fit", className)} {...props} />;
}

function SelectValue({ className, ...props }: React.ComponentProps<typeof SelectValuePrimitive>) {
  return (
    <SelectValuePrimitive
      data-slot="select-value"
      className={cn("flex flex-1 text-left data-placeholder:text-muted-foreground", className)}
      {...props}
    />
  );
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: Omit<React.ComponentProps<typeof ButtonPrimitive>, "children"> & {
  children?: React.ReactNode;
  size?: "sm" | "default";
}) {
  return (
    <ButtonPrimitive
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "flex w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-placeholder:text-muted-foreground data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronDownIcon className="pointer-events-none size-4 text-muted-foreground" />
    </ButtonPrimitive>
  );
}

function SelectContent({
  className,
  children,
  placement = "bottom start",
  offset = 4,
  crossOffset = 0,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive>) {
  return (
    <PopoverPrimitive
      data-slot="select-content"
      placement={placement}
      offset={offset}
      crossOffset={crossOffset}
      className={cn(
        "relative isolate z-50 w-(--trigger-width) min-w-36 origin-(--trigger-anchor-point) overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-entering:animate-in data-entering:fade-in-0 data-entering:zoom-in-95 data-exiting:animate-out data-exiting:fade-out-0 data-exiting:zoom-out-95 data-[placement=bottom]:slide-in-from-top-2 data-[placement=left]:slide-in-from-right-2 data-[placement=right]:slide-in-from-left-2 data-[placement=top]:slide-in-from-bottom-2 **:data-[slot=select-item]:data-focused:bg-foreground/10",
        className,
      )}
      {...props}
    >
      {children}
    </PopoverPrimitive>
  );
}

function SelectList({ className, ...props }: React.ComponentProps<typeof ListBoxPrimitive>) {
  return (
    <ListBoxPrimitive
      data-slot="select-list"
      className={cn(
        "max-h-[inherit] overflow-x-hidden overflow-y-auto p-1 outline-hidden",
        className,
      )}
      {...props}
    />
  );
}

function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ListBoxItemPrimitive>) {
  return (
    <ListBoxItemPrimitive
      data-slot="select-item"
      textValue={typeof children === "string" ? children : undefined}
      className={cn(
        "relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none data-focused:bg-accent data-focused:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {composeRenderProps(children, (renderedChildren, { isSelected }) => (
        <>
          {renderedChildren}
          {isSelected ? (
            <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
              <CheckIcon />
            </span>
          ) : null}
        </>
      ))}
    </ListBoxItemPrimitive>
  );
}

export { Select, SelectContent, SelectItem, SelectList, SelectTrigger, SelectValue };
