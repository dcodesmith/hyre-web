import { Link } from "@remix-run/react";
import { Button } from "~/components/ui/button";
import { HomeIcon, LockClosedIcon } from "@heroicons/react/24/outline";

interface ForbiddenPageProps {
  readonly appName?: string;
}

export function ForbiddenPage({ appName = "Tripdly" }: ForbiddenPageProps) {
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
              {/* Lock illustration */}
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-amber-50 flex items-center justify-center">
                <LockClosedIcon className="w-16 h-16 md:w-20 md:h-20 text-amber-400" />
              </div>
              {/* Floating 403 badge */}
              <div className="absolute -top-2 -right-2 bg-amber-500 text-white text-sm font-bold px-3 py-1 rounded-full">
                403
              </div>
            </div>
          </div>

          {/* Error message */}
          <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 mb-3">
            Access Denied
          </h1>
          <p className="text-neutral-600 text-base md:text-lg mb-8 max-w-md mx-auto">
            Sorry, you don't have permission to access this page. Please sign in with an authorized account or contact support if you believe this is an error.
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
              <Link to="/auth">
                <LockClosedIcon className="w-5 h-5" />
                Sign In
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
