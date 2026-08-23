import type { ReactNode } from "react";

import { BrandLink } from "~/components/layout/brand-link";
import { LEGAL_CONSTANTS } from "~/content/legal";

interface ErrorPageLayoutProps {
  readonly children: ReactNode;
  readonly showCopyright?: boolean;
}

export function ErrorPageLayout({ children, showCopyright = false }: ErrorPageLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-linear-to-b from-neutral-50 to-white">
      <header className="p-4 md:p-6">
        <BrandLink className="text-neutral-900" />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-8 md:py-16">
        <div className="w-full max-w-lg text-center">{children}</div>
      </main>
      {showCopyright ? (
        <footer className="p-4 text-center md:p-6">
          <p className="text-sm text-neutral-400">
            ©{" "}
            <span data-visual-dynamic suppressHydrationWarning>
              {new Date().getFullYear()}
            </span>{" "}
            {LEGAL_CONSTANTS.companyName}. All rights reserved.
          </p>
        </footer>
      ) : null}
    </div>
  );
}
