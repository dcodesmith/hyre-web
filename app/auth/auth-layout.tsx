import type { ReactNode } from "react";

import { BrandLink, brandBarClassName } from "~/components/layout/brand-link";
import { cn } from "~/lib/utils";

interface AuthLayoutProps {
  readonly children: ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="relative grid min-h-dvh w-full place-items-center bg-white px-6 py-8">
      <header className={cn("absolute inset-x-0 top-0 z-10", brandBarClassName)}>
        <BrandLink className="text-neutral-900" />
      </header>

      <main id="main-content" tabIndex={-1} className="w-full max-w-sm">
        {children}
      </main>
    </div>
  );
}
