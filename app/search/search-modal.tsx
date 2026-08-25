import type { ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { cn } from "~/lib/utils";
import { AiSearchModal } from "~/search/ai-search-modal";
import { SearchForm } from "~/search/search-form";

interface SearchModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onOpen?: () => void;
  readonly trigger?: ReactNode;
  readonly preserveFilterParams?: boolean;
}

const dialogContentClasses = cn(
  "flex w-full flex-col gap-0 p-0 pt-4",
  "inset-0 max-h-none max-w-none translate-x-0 translate-y-0 rounded-none sm:max-w-none",
  "duration-200 data-open:!zoom-in-100 data-closed:!zoom-out-100",
  "md:inset-auto md:top-1/2 md:left-1/2 md:h-auto md:max-h-[calc(100dvh-2rem)] md:max-w-2xl md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-lg",
);

export function SearchModal({
  isOpen,
  onClose,
  onOpen,
  trigger,
  preserveFilterParams = false,
}: SearchModalProps) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (open) {
          onOpen?.();
          return;
        }

        onClose();
      }}
    >
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className={dialogContentClasses} showCloseButton>
        <DialogHeader className="sr-only">
          <DialogTitle>Search</DialogTitle>
          <DialogDescription>Search for chauffeur-driven vehicles</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-6">
          <SearchForm
            context="modal"
            preserveFilterParams={preserveFilterParams}
            onSearchComplete={onClose}
          />
          <div className="mt-4 flex justify-center">
            <AiSearchModal />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
