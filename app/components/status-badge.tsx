import type { ReactNode } from "react";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

export const statusBadgeTones = {
  success: "bg-green-50 text-green-700 ring-green-600/15",
  warning: "bg-amber-50 text-amber-700 ring-amber-600/15",
  danger: "bg-red-50 text-red-700 ring-red-600/15",
  info: "bg-blue-50 text-blue-700 ring-blue-600/15",
  muted: "bg-gray-50 text-gray-600 ring-gray-500/15",
} as const;

export type StatusBadgeTone = keyof typeof statusBadgeTones;

export function StatusBadge({
  children,
  className,
  tone,
}: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly tone: StatusBadgeTone;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-6 rounded-md border-none px-2.5 font-semibold ring-1 ring-inset",
        statusBadgeTones[tone],
        className,
      )}
    >
      {children}
    </Badge>
  );
}
