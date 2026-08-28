import { CheckIcon, XIcon } from "lucide-react";
import { useFetcher } from "react-router";

import type { AdminCarAssetStatus } from "~/api/admin/cars/schema";
import { Button, buttonVariants } from "~/components/ui/button";
import { Field, FieldLabel } from "~/components/ui/field";
import { cn } from "~/lib/utils";
import type { AdminCarActionData } from "./admin-car-action-schema";

export function AdminCarAssetActions({
  assetId,
  kind,
  status,
}: {
  readonly assetId: string;
  readonly kind: "image" | "document";
  readonly status: AdminCarAssetStatus;
}) {
  const fetcher = useFetcher<AdminCarActionData>();
  const isSubmitting = fetcher.state !== "idle";
  const error = fetcher.state === "idle" ? fetcher.data?.error : undefined;
  const label = kind;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {status !== "APPROVED" ? (
          <fetcher.Form method="post">
            <input type="hidden" name="intent" value={`approve-${kind}`} />
            <input type="hidden" name="assetId" value={assetId} />
            <Button type="submit" disabled={isSubmitting}>
              <CheckIcon data-icon="inline-start" />
              {isSubmitting ? "Saving…" : "Approve"}
            </Button>
          </fetcher.Form>
        ) : null}

        {status !== "REJECTED" ? (
          <details>
            <summary
              className={cn(buttonVariants({ variant: "destructive" }), "cursor-pointer list-none")}
            >
              <XIcon data-icon="inline-start" />
              Reject {label}
            </summary>
            <fetcher.Form
              method="post"
              className="mt-2 min-w-64 space-y-2 rounded-lg border bg-background p-3"
            >
              <input type="hidden" name="intent" value={`reject-${kind}`} />
              <input type="hidden" name="assetId" value={assetId} />
              <Field>
                <FieldLabel htmlFor={`reject-${kind}-${assetId}`}>
                  Reason for rejecting this {label}
                </FieldLabel>
                <textarea
                  id={`reject-${kind}-${assetId}`}
                  name="notes"
                  required
                  disabled={isSubmitting}
                  className="min-h-20 w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </Field>
              <Button type="submit" variant="destructive" disabled={isSubmitting}>
                {isSubmitting ? "Rejecting…" : `Reject ${label}`}
              </Button>
            </fetcher.Form>
          </details>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
