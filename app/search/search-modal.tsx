import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { cn } from "~/lib/utils";
import { SearchForm } from "~/search/search-form";

interface SearchModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly preserveFilterParams?: boolean;
}

const dialogContentClasses = cn(
  "flex w-full flex-col gap-0 p-0 pt-4",
  "top-0 h-full max-h-screen translate-y-0 rounded-none",
  "data-open:slide-in-from-top",
  "max-w-full md:top-[50%] md:h-auto md:max-h-[90vh] md:max-w-2xl md:translate-y-[-50%] md:rounded-lg",
  "md:data-open:slide-in-from-top-[48%]",
);

export function SearchModal({ isOpen, onClose, preserveFilterParams = false }: SearchModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={dialogContentClasses} showCloseButton>
        <DialogHeader className="sr-only">
          <DialogTitle>Search</DialogTitle>
          <DialogDescription>Search for chauffeur-driven vehicles</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <SearchForm
            context="modal"
            preserveFilterParams={preserveFilterParams}
            onSearchComplete={onClose}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
