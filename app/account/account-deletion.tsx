import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useFetcher } from "react-router";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

export type AccountDeletionActionData = {
  error?: string;
};

const focusDeletionError = (node: HTMLParagraphElement | null) => node?.focus();

function DeletionError({ message }: { readonly message: string }) {
  return (
    <p className="text-sm text-red-600" role="alert" tabIndex={-1} ref={focusDeletionError}>
      {message}
    </p>
  );
}

function DeletingLabel() {
  return (
    <>
      <span className="inline-flex animate-spin motion-reduce:animate-none">
        <Loader2 className="size-4" aria-hidden="true" />
      </span>
      {" Deleting…"}
    </>
  );
}

export function AccountDeletion() {
  const fetcher = useFetcher<AccountDeletionActionData>();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const isDeleting = fetcher.state !== "idle";
  const error = fetcher.data?.error;

  return (
    <section className="mt-6 max-w-md border-t border-red-200 pt-4">
      <div className="space-y-2">
        <h2 className="text-sm font-medium text-red-600">Danger Zone</h2>
        <p className="text-sm text-muted-foreground">
          Once you delete your account, there is no going back. Your profile and identity data will
          be permanently removed, and your booking history will be anonymized for records.
        </p>
        {error && !confirmOpen ? <DeletionError key={error} message={error} /> : null}
        <Button
          type="button"
          variant="destructive"
          disabled={isDeleting}
          onClick={() => setConfirmOpen(true)}
        >
          {isDeleting ? <DeletingLabel /> : "Delete Account"}
        </Button>
      </div>

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!isDeleting) {
            setConfirmOpen(open);
          }
        }}
      >
        <DialogContent showCloseButton={!isDeleting} className="max-w-lg p-6 sm:max-w-106.25">
          <DialogHeader className="gap-1.5">
            <DialogTitle className="text-lg font-semibold">Are you absolutely sure?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete your account, including
              your profile, bank details, and identity documents. Your booking history will be
              anonymized for our records.
            </DialogDescription>
          </DialogHeader>
          {error ? <DeletionError key={error} message={error} /> : null}
          <fetcher.Form method="post" action="/api/account/delete">
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={isDeleting}
                onClick={() => setConfirmOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={isDeleting}>
                {isDeleting ? <DeletingLabel /> : "Delete Account"}
              </Button>
            </div>
          </fetcher.Form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
