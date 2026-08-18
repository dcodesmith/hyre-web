import { Search } from "lucide-react";

export function SearchButton() {
  return (
    <div className="flex items-center justify-center self-stretch border-t md:border-t-0 md:border-l md:border-gray-200">
      <div className="flex min-h-15 w-full items-center justify-center px-4 py-3 sm:px-3 md:w-auto md:py-2">
        <button
          type="submit"
          aria-label="Search for vehicles"
          className="inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground transition-colors duration-300 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:w-auto md:px-8 md:text-base"
        >
          <Search className="mr-2 size-4 shrink-0" aria-hidden="true" />
          <span className="md:hidden">Search</span>
        </button>
      </div>
    </div>
  );
}
