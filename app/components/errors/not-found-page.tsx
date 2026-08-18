import { CarFront, House, RouteOff } from "lucide-react";
import { Link } from "react-router";

import { ErrorPageLayout } from "~/components/errors/error-page-layout";
import { Button } from "~/components/ui/button";
import { LEGAL_CONSTANTS } from "~/constants/legal";

export function NotFoundPage() {
  return (
    <ErrorPageLayout showCopyright>
      <div className="mb-8 flex justify-center">
        <div className="relative">
          <div className="flex size-32 items-center justify-center rounded-full bg-neutral-100 md:size-40">
            <RouteOff aria-hidden="true" className="size-20 text-neutral-400 md:size-24" />
          </div>
          <div className="absolute -top-2 -right-2 rounded-full bg-neutral-900 px-3 py-1 text-sm font-bold text-white">
            404
          </div>
        </div>
      </div>
      <h1 className="mb-3 text-3xl font-bold text-neutral-900 md:text-4xl">Page not found</h1>
      <p className="mx-auto mb-8 max-w-md text-base text-neutral-600 md:text-lg">
        Sorry, we couldn't find the page you're looking for. The route might have changed or the
        page may no longer exist.
      </p>
      <div className="mb-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Button asChild size="lg">
          <Link to="/">
            <House data-icon="inline-start" />
            Back to Home
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link to="/search">
            <CarFront data-icon="inline-start" />
            Browse Cars
          </Link>
        </Button>
      </div>
      <p className="text-sm text-neutral-500">
        Need help?{" "}
        <a
          href={`mailto:${LEGAL_CONSTANTS.supportEmail}`}
          className="text-neutral-900 underline underline-offset-2 hover:text-neutral-700"
        >
          Contact support
        </a>
      </p>
    </ErrorPageLayout>
  );
}
