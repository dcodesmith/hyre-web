import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useFetcher } from "react-router";

import type { BookingDetail } from "~/api/bookings/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { cn } from "~/lib/utils";

export type BookingCancelActionData = {
  error?: string;
  ok?: true;
};

const focusRingClassName =
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";
const triggerClassName = cn(
  "inline-flex h-9 w-full items-center justify-center gap-2 rounded-sm border border-input bg-background px-3 text-sm font-medium text-red-600 hover:bg-accent hover:text-red-700",
  focusRingClassName,
);
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

function focusCancelError(node: HTMLParagraphElement | null) {
  node?.focus();
}

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
    <>
      <section className="rounded border bg-card text-card-foreground shadow-sm">
        <div className="p-4">
          <div className="space-y-2">
            {cancelError && !showConfirm ? (
              <CancelError key={cancelError} message={cancelError} />
            ) : null}
            <button
              type="button"
              className={triggerClassName}
              disabled={isBusy}
              onClick={() => setConfirmOpen(true)}
            >
              {isBusy ? (
                <>
                  <CancelSpinner className="h-4 w-4" />
                  Cancelling…
                </>
              ) : (
                "Cancel Booking"
              )}
            </button>
          </div>
        </div>
      </section>

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
    </>
  );
}
