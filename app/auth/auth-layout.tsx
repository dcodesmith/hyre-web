import type { ReactNode } from "react";

import { BrandLink } from "~/components/layout/brand-link";

interface AuthLayoutProps {
  readonly children: ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="relative grid min-h-dvh w-full place-items-center bg-white px-6 py-8">
      <header className="absolute inset-x-0 top-0 z-10 flex h-14 items-center border-transparent px-4 md:h-[126px] md:border-b md:border-gray-200 md:bg-gray-100">
        <BrandLink className="text-neutral-900" />
      </header>

      <main id="main-content" tabIndex={-1} className="w-full max-w-sm">
        {children}
      </main>
    </div>
  );
}
