import { cn } from "cn";
import { Loader2, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { useFetcher } from "react-router";
import type { BookingDetail } from "~/api/bookings/schema";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

export type BookingCancelActionData = {
  error?: string;
  ok?: true;
};

const focusRingClassName =
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";
const outlineButtonClassName = cn(
  "inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50",
  focusRingClassName,
);
const destructiveButtonClassName = cn(
  "inline-flex h-10 items-center justify-center rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:pointer-events-none disabled:opacity-50",
  focusRingClassName,
);

function CancelSpinner({ className }: { readonly className: string }) {
  return (
    <span className="inline-flex animate-spin motion-reduce:animate-none">
      <Loader2 className={className} aria-hidden="true" />
    </span>
  );
}

const focusCancelError = (node: HTMLParagraphElement | null) => node?.focus();

function CancelError({ message }: { readonly message: string }) {
  return (
    <p className="text-sm text-red-600" role="alert" tabIndex={-1} ref={focusCancelError}>
      {message}
    </p>
  );
}

export function BookingCancelCard({
  paymentStatus,
}: {
  readonly paymentStatus: BookingDetail["paymentStatus"];
}) {
  const fetcher = useFetcher<BookingCancelActionData>();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const isBusy = fetcher.data?.ok === true || fetcher.state !== "idle";
  const cancelError = fetcher.data?.error;
  const showConfirm = confirmOpen && fetcher.data?.ok !== true;

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="size-12 rounded-md border-gray-200 bg-white p-1 shadow-sm"
            aria-label="Booking actions"
            disabled={isBusy}
          >
            <MoreHorizontal aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            variant="destructive"
            disabled={isBusy}
            onSelect={() => setConfirmOpen(true)}
          >
            Cancel Booking
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {cancelError && !showConfirm ? <CancelError key={cancelError} message={cancelError} /> : null}

      <Dialog
        open={showConfirm}
        onOpenChange={(nextOpen) => {
          if (isBusy) {
            return;
          }

          setConfirmOpen(nextOpen);
        }}
      >
        <DialogContent
          showCloseButton={!isBusy}
          overlayClassName="z-60"
          className="z-60 w-full max-w-lg gap-4 overflow-y-auto overscroll-contain border border-neutral-200 bg-white p-6 text-neutral-950 shadow-lg sm:max-w-[425px] sm:rounded-lg"
        >
          <DialogHeader className="gap-1.5 text-center">
            <DialogTitle className="text-lg leading-none font-semibold tracking-tight">
              Cancel Booking
            </DialogTitle>
            <DialogDescription className="text-sm text-neutral-500">
              <span className="block">
                Are you sure you want to cancel this booking? This action cannot be undone.
              </span>
              {paymentStatus === "PAID" ? (
                <span className="block">A refund will be processed automatically.</span>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          {cancelError ? <CancelError key={cancelError} message={cancelError} /> : null}
          <fetcher.Form method="post" className="space-y-4">
            <input type="hidden" name="intent" value="cancel" />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                className={outlineButtonClassName}
                disabled={isBusy}
                onClick={() => setConfirmOpen(false)}
              >
                Cancel
              </button>
              <button type="submit" disabled={isBusy} className={destructiveButtonClassName}>
                {isBusy ? (
                  <>
                    <CancelSpinner className="mr-2 h-4 w-4" />
                    Cancelling…
                  </>
                ) : (
                  "Yes, Cancel Booking"
                )}
              </button>
            </div>
          </fetcher.Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
