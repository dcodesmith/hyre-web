import { Link } from "@remix-run/react";
import { Button } from "~/components/ui/button";
import { HomeIcon, TruckIcon } from "@heroicons/react/24/outline";

interface NotFoundPageProps {
  readonly appName?: string;
}

export function NotFoundPage({ appName = "Tripdly" }: NotFoundPageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-white flex flex-col">
      {/* Header */}
      <header className="p-4 md:p-6">
        <Link to="/" className="text-2xl md:text-3xl font-bold font-dancingscript text-neutral-900">
          {appName}
        </Link>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 md:py-16">
        <div className="max-w-lg w-full text-center">
          {/* Illustration */}
          <div className="mb-8 flex justify-center">
            <div className="relative">
              {/* Road/path illustration */}
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-neutral-100 flex items-center justify-center">
                <svg
                  viewBox="0 0 100 100"
                  className="w-20 h-20 md:w-24 md:h-24 text-neutral-400"
                  fill="none"
                  aria-label="Road/path illustration"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <title>Road/path illustration</title>
                  {/* Winding road */}
                  <path
                    d="M20 80 Q35 60, 50 50 Q65 40, 50 30 Q35 20, 50 10"
                    strokeLinecap="round"
                    className="text-neutral-300"
                    strokeWidth="8"
                  />
                  {/* Road lines */}
                  <path
                    d="M20 80 Q35 60, 50 50 Q65 40, 50 30 Q35 20, 50 10"
                    strokeLinecap="round"
                    strokeDasharray="4 4"
                    className="text-neutral-500"
                  />
                  {/* Car icon at end of road */}
                  <circle cx="50" cy="10" r="6" className="fill-neutral-900" />
                  {/* Question mark */}
                  <text x="47" y="14" className="fill-white text-[8px] font-bold">
                    ?
                  </text>
                </svg>
              </div>
              {/* Floating 404 badge */}
              <div className="absolute -top-2 -right-2 bg-neutral-900 text-white text-sm font-bold px-3 py-1 rounded-full">
                404
              </div>
            </div>
          </div>

          {/* Error message */}
          <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 mb-3">Page not found</h1>
          <p className="text-neutral-600 text-base md:text-lg mb-8 max-w-md mx-auto">
            Sorry, we couldn't find the page you're looking for. The route might have changed or the
            page may no longer exist.
          </p>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
            <Button asChild size="lg" className="gap-2">
              <Link to="/">
                <HomeIcon className="w-5 h-5" />
                Back to Home
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="gap-2">
              <Link to="/search">
                <TruckIcon className="w-5 h-5" />
                Browse Cars
              </Link>
            </Button>
          </div>

          {/* Help text */}
          <p className="text-sm text-neutral-500">
            Need help?{" "}
            <a
              href="mailto:support@tripdly.com"
              className="text-neutral-900 underline underline-offset-2 hover:text-neutral-700"
            >
              Contact support
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
