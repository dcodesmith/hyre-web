import { Link } from "react-router";

import { LEGAL_CONSTANTS } from "~/content/legal";
import { cn } from "~/lib/utils";

interface BrandLinkProps {
  readonly className?: string;
}

export function BrandLink({ className }: BrandLinkProps) {
  return (
    <Link
      to="/"
      translate="no"
      prefetch="intent"
      className={cn(
        "font-brand shrink-0 text-2xl font-bold no-underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-3xl",
        className,
      )}
    >
      {LEGAL_CONSTANTS.companyName}
    </Link>
  );
}
