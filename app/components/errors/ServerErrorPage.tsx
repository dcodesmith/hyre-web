import { Link } from "@remix-run/react";
import { Button } from "~/components/ui/button";
import { HomeIcon, ArrowPathIcon } from "@heroicons/react/24/outline";

interface ServerErrorPageProps {
  readonly appName?: string;
  readonly error?: {
    readonly status?: number;
    readonly statusText?: string;
    readonly message?: string;
  };
  readonly showDetails?: boolean;
}

export function ServerErrorPage({
  appName = "Tripdly",
  error,
  showDetails = false,
}: ServerErrorPageProps) {
  const statusCode = error?.status || 500;
  const statusText = error?.statusText || "Internal Server Error";

  const handleRefresh = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-white flex flex-col">
      {/* Header */}
      <header className="p-4 md:p-6">
        <Link
          to="/"
          className="text-2xl md:text-3xl font-bold font-dancingscript text-neutral-900"
        >
          {appName}
        </Link>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 md:py-16">
        <div className="max-w-lg w-full text-center">
          {/* Illustration */}
          <div className="mb-8 flex justify-center">
            <div className="relative">
              {/* Warning illustration */}
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-red-50 flex items-center justify-center">
                <div className="relative">
                  {/* Gear with warning */}
                  <svg
                    viewBox="0 0 100 100"
                    className="w-20 h-20 md:w-24 md:h-24"
                    fill="none"
                  >
                    {/* Gear */}
                    <path
                      d="M50 20 L55 25 L60 20 L65 25 L70 20 L72 28 L80 30 L78 38 L85 43 L80 50 L85 57 L78 62 L80 70 L72 72 L70 80 L65 75 L60 80 L55 75 L50 80 L45 75 L40 80 L35 75 L30 80 L28 72 L20 70 L22 62 L15 57 L20 50 L15 43 L22 38 L20 30 L28 28 L30 20 L35 25 L40 20 L45 25 Z"
                      className="fill-red-100 stroke-red-200"
                      strokeWidth="2"
                    />
                    {/* Inner circle */}
                    <circle
                      cx="50"
                      cy="50"
                      r="18"
                      className="fill-red-50 stroke-red-300"
                      strokeWidth="2"
                    />
                    {/* Exclamation mark */}
                    <rect x="47" y="38" width="6" height="14" rx="2" className="fill-red-500" />
                    <circle cx="50" cy="58" r="3" className="fill-red-500" />
                  </svg>
                </div>
              </div>
              {/* Floating status badge */}
              <div className="absolute -top-2 -right-2 bg-red-500 text-white text-sm font-bold px-3 py-1 rounded-full">
                {statusCode}
              </div>
            </div>
          </div>

          {/* Error message */}
          <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 mb-3">
            Something went wrong
          </h1>
          <p className="text-neutral-600 text-base md:text-lg mb-2">
            We're experiencing some technical difficulties.
          </p>
          <p className="text-neutral-500 text-sm md:text-base mb-8 max-w-md mx-auto">
            Our team has been notified and we're working to fix this. Please try again in a moment.
          </p>

          {/* Show error details in development */}
          {showDetails && error?.message && (
            <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg text-left">
              <p className="text-sm font-medium text-red-800 mb-1">
                {statusCode} - {statusText}
              </p>
              <p className="text-xs text-red-600 font-mono break-all">
                {error.message}
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
            <Button onClick={handleRefresh} size="lg" className="gap-2">
              <ArrowPathIcon className="w-5 h-5" />
              Try Again
            </Button>
            <Button asChild variant="outline" size="lg" className="gap-2">
              <Link to="/">
                <HomeIcon className="w-5 h-5" />
                Back to Home
              </Link>
            </Button>
          </div>

          {/* Help text */}
          <p className="text-sm text-neutral-500">
            If the problem persists,{" "}
            <a
              href="mailto:support@tripdly.com"
              className="text-neutral-900 underline underline-offset-2 hover:text-neutral-700"
            >
              contact our support team
            </a>
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-4 md:p-6 text-center">
        <p className="text-sm text-neutral-400">
          &copy; {new Date().getFullYear()} {appName}. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
