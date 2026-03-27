import { cn } from "~/lib/utils";
import { AISearchModal } from "./AISearchModal";
import { BookingSearch, BookingSearchDraftProvider } from "./BookingSearch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";

interface SearchModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly navigateToSearch?: boolean;
  readonly searchBasePath?: string;
  readonly preservedSearchParams?: URLSearchParams;
}

const dialogContentClasses = cn(
  // Base styles
  "w-full p-0 gap-0 flex flex-col pt-4",
  // Mobile styles (full screen)
  "h-full max-h-screen rounded-none top-0 translate-y-0",
  "data-[state=open]:slide-in-from-top",
  // Desktop styles (centered modal)
  "md:h-auto md:max-h-[90vh] max-w-full md:max-w-2xl",
  "md:rounded-lg md:top-[50%] md:translate-y-[-50%]",
  "md:data-[state=open]:slide-in-from-top-[48%]",
);

export function SearchModal({
  isOpen,
  onClose,
  navigateToSearch = false,
  searchBasePath = "/search",
  preservedSearchParams,
}: SearchModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={dialogContentClasses}>
        <DialogHeader className="sr-only">
          <DialogTitle>Search</DialogTitle>
          <DialogDescription>Search modal</DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto px-4 py-6 flex-1">
          <BookingSearchDraftProvider>
            <BookingSearch
              isCompact={false}
              context="modal"
              navigateToSearch={navigateToSearch}
              searchBasePath={searchBasePath}
              preservedSearchParams={preservedSearchParams}
              onSearchComplete={onClose}
            />
          </BookingSearchDraftProvider>

          <div className="mt-4 flex justify-center">
            <AISearchModal />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
