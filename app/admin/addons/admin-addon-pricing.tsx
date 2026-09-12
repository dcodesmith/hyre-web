import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { useFetcher } from "react-router";

import { AddonActionFeedback } from "~/admin/addons/addon-action-feedback";
import { type AddonActionData, createAddonPriceFormSchema } from "~/admin/addons/addon-form-schema";
import type { AdminAddon } from "~/api/admin/addons/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Field, FieldError, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { formatCurrency } from "~/money/currency";

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function formatDateTime(value: string) {
  return `${dateTimeFormatter.format(new Date(value))} UTC`;
}

function getPriceStatus(
  price: AdminAddon["prices"][number],
  now: string,
): "Active" | "Ended" | "Scheduled" {
  if (price.effectiveSince > now) {
    return "Scheduled";
  }

  return price.effectiveUntil && price.effectiveUntil <= now ? "Ended" : "Active";
}

function CreatePriceForm({ addonId }: { readonly addonId: string }) {
  const fetcher = useFetcher<AddonActionData>();
  const [form, fields] = useForm({
    id: `create-addon-price-${addonId}`,
    lastResult: fetcher.data?.intent === "create-price" ? fetcher.data.submission : undefined,
    constraint: getZodConstraint(createAddonPriceFormSchema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: createAddonPriceFormSchema });
    },
  });

  return (
    <fetcher.Form method="post" {...getFormProps(form)} className="grid gap-4 sm:grid-cols-3">
      <input type="hidden" name="intent" value="create-price" />
      <input type="hidden" name="addonId" value={addonId} />
      <Field data-invalid={Boolean(fields.amount.errors)}>
        <FieldLabel htmlFor={fields.amount.id}>Amount (NGN)</FieldLabel>
        <Input
          {...getInputProps(fields.amount, { type: "number" })}
          autoComplete="off"
          inputMode="decimal"
          min="0.01"
          step="0.01"
        />
        <FieldError errors={fields.amount.errors} />
      </Field>
      <Field data-invalid={Boolean(fields.effectiveSince.errors)}>
        <FieldLabel htmlFor={fields.effectiveSince.id}>Effective from (UTC)</FieldLabel>
        <Input
          {...getInputProps(fields.effectiveSince, { type: "datetime-local" })}
          autoComplete="off"
        />
        <FieldError errors={fields.effectiveSince.errors} />
      </Field>
      <Field data-invalid={Boolean(fields.effectiveUntil.errors)}>
        <FieldLabel htmlFor={fields.effectiveUntil.id}>Effective until (optional)</FieldLabel>
        <Input
          {...getInputProps(fields.effectiveUntil, { type: "datetime-local" })}
          autoComplete="off"
        />
        <FieldError errors={fields.effectiveUntil.errors} />
      </Field>
      <div className="space-y-3 sm:col-span-3">
        <AddonActionFeedback
          data={fetcher.data}
          title={fetcher.data?.error ? "Price not created" : "Price created"}
        />
        <Button type="submit" disabled={fetcher.state !== "idle"}>
          {fetcher.state === "idle" ? "Add price" : "Adding…"}
        </Button>
      </div>
    </fetcher.Form>
  );
}

function EndPriceButton({
  addonId,
  priceId,
}: {
  readonly addonId: string;
  readonly priceId: string;
}) {
  const fetcher = useFetcher<AddonActionData>();

  return (
    <div className="max-w-xs space-y-2">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button type="button" size="sm" variant="outline" disabled={fetcher.state !== "idle"}>
            End now
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End this price now?</AlertDialogTitle>
            <AlertDialogDescription>
              New bookings will stop using this price immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep price</AlertDialogCancel>
            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="end-price" />
              <input type="hidden" name="addonId" value={addonId} />
              <input type="hidden" name="priceId" value={priceId} />
              <AlertDialogAction type="submit">End price</AlertDialogAction>
            </fetcher.Form>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AddonActionFeedback
        data={fetcher.data}
        title={fetcher.data?.error ? "Price not ended" : "Price ended"}
      />
    </div>
  );
}

export function AdminAddonPricing({
  addon,
  now,
}: {
  readonly addon: AdminAddon;
  readonly now: string;
}) {
  return (
    <details className="rounded-lg border p-3">
      <summary className="cursor-pointer text-sm font-medium">
        Prices ({addon.prices.length})
      </summary>
      <div className="mt-4 space-y-4 border-t pt-4">
        <p className="text-xs text-muted-foreground">
          Customers can select this add-on only while a price is active.
        </p>
        {addon.prices.length > 0 ? (
          <ul className="space-y-3 text-sm">
            {addon.prices.map((price) => {
              const status = getPriceStatus(price, now);
              const canEnd = status === "Active" && price.effectiveUntil == null;

              return (
                <li key={price.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <span className="inline-flex items-center gap-2">
                      <strong className="tabular-nums">{formatCurrency(price.amount)}</strong>
                      <Badge variant={status === "Active" ? "default" : "secondary"}>
                        {status}
                      </Badge>
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {formatDateTime(price.effectiveSince)} –{" "}
                      {price.effectiveUntil ? formatDateTime(price.effectiveUntil) : "No end date"}
                    </span>
                  </span>
                  {canEnd ? <EndPriceButton addonId={addon.id} priceId={price.id} /> : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No prices yet.</p>
        )}
        <CreatePriceForm addonId={addon.id} />
      </div>
    </details>
  );
}
