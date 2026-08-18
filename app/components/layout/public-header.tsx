import { Link } from "react-router";

import { Button } from "~/components/ui/button";
import { LEGAL_CONSTANTS } from "~/constants/legal";

export function PublicHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 hidden h-17.25 items-center justify-between border-b border-gray-200 bg-white px-4 shadow-sm md:flex">
      <Link
        to="/"
        translate="no"
        className="font-brand text-3xl font-bold text-gray-900 transition-colors hover:text-gray-700 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {LEGAL_CONSTANTS.companyName}
      </Link>

      <Button asChild variant="outline" size="lg">
        <Link to="/auth">Register or Log in</Link>
      </Button>
    </header>
  );
}
