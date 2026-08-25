import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

export function DetailCard({ children }: { readonly children: ReactNode }) {
  return (
    <section className="rounded border bg-card text-card-foreground shadow-sm">{children}</section>
  );
}

export function DetailCardHeader({ children }: { readonly children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 p-4 text-sm leading-none font-semibold tracking-tight md:text-base">
      {children}
    </div>
  );
}

export function DetailCardBody({ children }: { readonly children: ReactNode }) {
  return <div className="p-4 pt-0">{children}</div>;
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
