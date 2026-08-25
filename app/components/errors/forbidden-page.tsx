import { House, LockKeyhole } from "lucide-react";
import { Link } from "react-router";

import { HTTP_STATUS } from "~/api/http-status";
import { ErrorPageLayout } from "~/components/errors/error-page-layout";
import { Button } from "~/components/ui/button";
import { LEGAL_CONSTANTS } from "~/content/legal";

export function ForbiddenPage() {
  return (
    <ErrorPageLayout>
      <div className="mb-8 flex justify-center">
        <div className="relative">
          <div className="flex size-32 items-center justify-center rounded-full bg-amber-50 md:size-40">
            <LockKeyhole aria-hidden="true" className="size-16 text-amber-400 md:size-20" />
          </div>
          <div className="absolute -top-2 -right-2 rounded-full bg-amber-500 px-3 py-1 text-sm font-bold text-white">
            {HTTP_STATUS.FORBIDDEN}
          </div>
        </div>
      </div>
      <h1 className="mb-3 text-3xl font-bold text-neutral-900 md:text-4xl">Access denied</h1>
      <p className="mx-auto mb-8 max-w-md text-base text-neutral-600 md:text-lg">
        You don't have permission to access this page. Sign in with an authorized account or contact
        support if you believe this is an error.
      </p>
      <div className="mb-8 flex justify-center">
        <Button asChild size="lg">
          <Link to="/">
            <House data-icon="inline-start" />
            Back to Home
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
