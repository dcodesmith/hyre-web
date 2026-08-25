import { Loader2, Search, Sparkles, X } from "lucide-react";
import { useId, useState } from "react";
import { useFetcher } from "react-router";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";

const EXAMPLE_QUERIES = [
  "Black Toyota SUV for 5 days",
  "Luxury sedan tomorrow night",
  "Airport pickup for BA75 tomorrow",
  "Executive car for 3 days starting today",
] as const;

const dialogContentClasses = cn(
  "flex w-full flex-col gap-0 overflow-y-auto overscroll-contain p-0",
  "inset-0 max-h-none max-w-none translate-x-0 translate-y-0 rounded-none sm:max-w-none",
  "pt-[max(1.5rem,env(safe-area-inset-top))] pb-[env(safe-area-inset-bottom)]",
  "duration-200 data-open:!zoom-in-100 data-closed:!zoom-out-100",
  "md:inset-auto md:top-1/2 md:left-1/2 md:h-auto md:max-h-[calc(100dvh-2rem)] md:max-w-2xl md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-lg",
  "md:pt-0 md:pb-0",
);

interface AiSearchActionData {
  readonly error: string | null;
}

export function AiSearchModal() {
  const queryFieldId = useId();
  const errorId = useId();
  const fetcher = useFetcher<AiSearchActionData>();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const isSubmitting = fetcher.state !== "idle";
  const error = fetcher.data?.error ?? null;
  const canSubmit = query.trim().length > 0 && !isSubmitting;

  const closeModal = () => {
    setQuery("");
    fetcher.reset();
    setIsOpen(false);
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        open ? setIsOpen(true) : closeModal();
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full bg-linear-to-r from-neutral-900 to-neutral-700 px-4 py-2 text-sm font-medium text-white shadow-sm ring-1 ring-white/50 transition-[box-shadow,background-image] hover:from-neutral-800 hover:to-neutral-600 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
        >
          <Sparkles aria-hidden="true" className="size-4" />
          Search by AI
        </button>
      </DialogTrigger>
      <DialogContent className={dialogContentClasses} showCloseButton>
        <div className="border-b border-gray-100 px-6 pt-6 pb-4">
          <DialogHeader>
            <DialogTitle className="text-left text-lg font-semibold text-pretty text-gray-900">
              Search by AI
            </DialogTitle>
            <DialogDescription className="mt-2 text-left text-gray-600">
              Describe what you’re looking for in natural language. For example: “I need a black
              Toyota SUV from today for 5 days”
            </DialogDescription>
          </DialogHeader>
        </div>

        <fetcher.Form method="post" action="/api/ai-search" className="space-y-4 px-6 py-5">
          <div className="space-y-2">
            <Label htmlFor={queryFieldId} className="text-sm font-medium text-gray-900">
              Describe your search
            </Label>
            <div className="relative">
              <textarea
                id={queryFieldId}
                name="query"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey && canSubmit) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder="E.g., I need a luxury sedan for tomorrow night, or a white SUV for airport pickup…"
                className="min-h-25 w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                disabled={isSubmitting}
                autoComplete="off"
                maxLength={500}
                required
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
              />
              {query && !isSubmitting ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute top-2 right-2 rounded-sm p-1 text-gray-400 transition-colors hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
                  aria-label="Clear search"
                >
                  <X aria-hidden="true" className="size-4" />
                </button>
              ) : null}
            </div>
          </div>

          {error ? (
            <p id={errorId} role="alert" className="text-sm text-red-600">
              {error}
            </p>
          ) : null}

          <div className="space-y-2">
            <p className="text-sm text-gray-600">Try these examples:</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_QUERIES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setQuery(example)}
                  disabled={isSubmitting}
                  className="rounded-full bg-gray-100 px-3 py-1.5 text-xs transition-colors hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 motion-reduce:transition-none"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-center gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="h-10 min-w-30 rounded-full"
              onClick={closeModal}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit}
              className="h-10 min-w-30 rounded-full"
              aria-label={isSubmitting ? "Searching with AI" : "Search with AI"}
            >
              {isSubmitting ? (
                <>
                  <Loader2 aria-hidden="true" className="mr-2 size-4 animate-spin" />
                  Searching…
                </>
              ) : (
                <>
                  <Search aria-hidden="true" className="mr-2 size-4" />
                  Search
                </>
              )}
            </Button>
          </div>
        </fetcher.Form>

        <div className="rounded-b-lg border-t border-gray-100 bg-gray-50 px-6 py-4">
          <p className="text-center text-xs text-gray-500">
            Powered by AI • Understands dates, colors, car types, and more
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
