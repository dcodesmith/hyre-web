import { CircleAlert, House, RefreshCw } from "lucide-react";
import { Link } from "react-router";

import { ErrorPageLayout } from "~/components/errors/error-page-layout";
import { Button } from "~/components/ui/button";
import { LEGAL_CONSTANTS } from "~/constants/legal";

interface ServerErrorPageProps {
  readonly details?: string;
  readonly showDetails?: boolean;
  readonly status?: number;
}

export function ServerErrorPage({
  details,
  showDetails = false,
  status = 500,
}: ServerErrorPageProps) {
  return (
    <ErrorPageLayout>
      <div className="mb-8 flex justify-center">
        <div className="relative">
          <div className="flex size-32 items-center justify-center rounded-full bg-red-50 md:size-40">
            <CircleAlert aria-hidden="true" className="size-20 text-red-400 md:size-24" />
          </div>
          <div className="absolute -top-2 -right-2 rounded-full bg-red-500 px-3 py-1 text-sm font-bold text-white">
            {status}
          </div>
        </div>
      </div>
      <h1 className="mb-3 text-3xl font-bold text-neutral-900 md:text-4xl">Something went wrong</h1>
      <p className="mb-2 text-base text-neutral-600 md:text-lg">
        We're experiencing some technical difficulties.
      </p>
      <p className="mx-auto mb-8 max-w-md text-sm text-neutral-500 md:text-base">
        Our team has been notified and we're working to fix this. Please try again in a moment.
      </p>
      {showDetails && details ? (
        <div className="mb-8 rounded-lg border border-red-200 bg-red-50 p-4 text-left">
          <p className="break-all font-mono text-xs text-red-600">{details}</p>
        </div>
      ) : null}
      <div className="mb-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Button type="button" size="lg" onClick={() => globalThis.location.reload()}>
          <RefreshCw data-icon="inline-start" />
          Try Again
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link to="/">
            <House data-icon="inline-start" />
            Back to Home
          </Link>
        </Button>
      </div>
      <p className="text-sm text-neutral-500">
        If the problem persists,{" "}
        <a
          href={`mailto:${LEGAL_CONSTANTS.supportEmail}`}
          className="text-neutral-900 underline underline-offset-2 hover:text-neutral-700"
        >
          contact our support team
        </a>
      </p>
    </ErrorPageLayout>
  );
}
