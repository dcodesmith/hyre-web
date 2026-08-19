import type { ReactNode } from "react";
import { Link } from "react-router";

import { LEGAL_CONSTANTS } from "~/content/legal";
import { SITE_ORIGIN } from "~/seo/metadata";
import { BreadcrumbStructuredData } from "~/seo/structured-data";

interface LegalPageLayoutProps {
  readonly children: ReactNode;
  readonly path: `/${string}`;
  readonly title: string;
}

export function LegalPageLayout({ children, path, title }: LegalPageLayoutProps) {
  return (
    <div className="min-h-screen bg-white">
      <BreadcrumbStructuredData
        items={[
          { name: "Home", url: SITE_ORIGIN },
          { name: title, url: `${SITE_ORIGIN}${path}` },
        ]}
      />
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <article className="max-w-none">
          <h1 className="mb-2 text-3xl font-bold text-gray-900">{title}</h1>
          <p className="mb-8 text-sm text-gray-500">Last updated: {LEGAL_CONSTANTS.lastUpdated}</p>
          {children}
          <div className="mt-12 border-t border-gray-200 pt-8">
            <Link to="/" className="text-primary hover:underline">
              &larr; Back to Home
            </Link>
          </div>
        </article>
      </div>
    </div>
  );
}
