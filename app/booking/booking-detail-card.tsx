import { cn } from "cn";
import type { ComponentProps, ReactNode } from "react";

export function DetailCard({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded border border-gray-200 bg-white text-gray-900",
        className,
      )}
      {...props}
    />
  );
}

export function DetailCardHeader({ children }: { readonly children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 p-4 text-base leading-6 font-semibold text-gray-900">
      {children}
    </div>
  );
}

export function DetailCardBody({ children }: { readonly children: ReactNode }) {
  return <div className="p-4">{children}</div>;
}

export function DetailCardIcon({ children }: { readonly children: ReactNode }) {
  return <span className="text-gray-900 [&_svg]:size-6">{children}</span>;
}

export function OutlineBadge({
  className,
  children,
}: {
  readonly className?: string;
  readonly children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-2.5 py-0.5 text-sm font-semibold capitalize",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function ConnectedStops({
  first,
  second,
  firstDotClassName = "bg-gray-300",
  secondDotClassName = "bg-gray-300",
  anchorClassName = "h-5",
  lineClassName = "-my-1",
}: {
  readonly first: ReactNode;
  readonly second: ReactNode;
  readonly firstDotClassName?: string;
  readonly secondDotClassName?: string;
  /** Height of the text row each dot is centered on. */
  readonly anchorClassName?: string;
  /** Pulls the connector into the anchor rows so it meets the dots. */
  readonly lineClassName?: string;
}) {
  return (
    <div>
      <div className="flex gap-[3px]">
        <div className="flex w-[18px] shrink-0 flex-col items-center">
          <div className={cn("flex w-full shrink-0 items-center justify-center", anchorClassName)}>
            <span className={cn("size-3 shrink-0 rounded-full", firstDotClassName)} />
          </div>
          <span className={cn("w-px flex-1 bg-gray-300", lineClassName)} />
        </div>
        <div className="min-w-0 flex-1 pb-4">{first}</div>
      </div>
      <div className="flex gap-[3px]">
        <div
          className={cn(
            "flex w-[18px] shrink-0 items-center justify-center self-start",
            anchorClassName,
          )}
        >
          <span className={cn("size-3 shrink-0 rounded-full", secondDotClassName)} />
        </div>
        <div className="min-w-0 flex-1">{second}</div>
      </div>
    </div>
  );
}
