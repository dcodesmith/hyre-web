import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { useFetcher } from "react-router";

import type { AddonRate } from "~/api/admin/rates/schema";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
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
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "~/components/ui/empty";
import { Field, FieldError, FieldLabel, FieldTitle } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";
import { formatCurrency } from "~/money/currency";
import { addonRateFormSchema, type RateActionData } from "./rate-form-schema";
import { RateWindowFields } from "./rate-window-fields";

const rateStatusTones = {
  Active: "bg-green-50 text-green-700 ring-green-600/15",
  Scheduled: "bg-blue-50 text-blue-700 ring-blue-600/15",
  Ended: "bg-gray-50 text-gray-600 ring-gray-500/15",
} as const;

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function formatDateTime(value: string) {
  return `${dateTimeFormatter.format(new Date(value))} UTC`;
}

function formatWindow(rate: AddonRate) {
  const end = rate.effectiveUntil ? formatDateTime(rate.effectiveUntil) : "No end date";
  return `${formatDateTime(rate.effectiveSince)} – ${end}`;
}

function getRateStatus(rate: AddonRate, now: string) {
  if (rate.active) {
    return "Active";
  }
  return rate.effectiveSince > now ? "Scheduled" : "Ended";
}

function EndAddonRateButton({ rate }: { readonly rate: AddonRate }) {
  const fetcher = useFetcher<RateActionData>();
  const formId = `end-addon-${rate.id}`;

  return (
    <>
      <fetcher.Form id={formId} method="post">
        <input type="hidden" name="intent" value="end-addon" />
        <input type="hidden" name="addonRateId" value={rate.id} />
      </fetcher.Form>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button type="button" variant="outline" disabled={fetcher.state !== "idle"}>
            End now
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End this add-on rate?</AlertDialogTitle>
            <AlertDialogDescription>
              The API will end this rate immediately. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction type="submit" form={formId} variant="destructive">
              End rate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {fetcher.data?.intent === "end-addon" && fetcher.data.error ? (
        <p role="alert" className="col-span-full text-sm text-destructive">
          {fetcher.data.error}
        </p>
      ) : null}
    </>
  );
}

function AddonRateCard({ now, rate }: { readonly now: string; readonly rate: AddonRate }) {
  const status = getRateStatus(rate, now);

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{formatCurrency(rate.rateAmount)}</CardTitle>
        <CardDescription>Security detail per booking leg</CardDescription>
        <CardAction>
          <Badge
            variant="outline"
            className={cn(
              "h-6 rounded-md border-none px-2.5 font-semibold ring-1 ring-inset",
              rateStatusTones[status],
            )}
          >
            {status}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <dl className="grid gap-2 text-sm">
          <div>
            <dt className="text-muted-foreground">Effective window</dt>
            <dd className="mt-0.5">{formatWindow(rate)}</dd>
          </div>
          {rate.description ? (
            <div>
              <dt className="text-muted-foreground">Description</dt>
              <dd className="mt-0.5 break-words whitespace-pre-wrap">{rate.description}</dd>
            </div>
          ) : null}
        </dl>
        {rate.active ? (
          <div className="grid justify-items-start gap-2">
            <EndAddonRateButton rate={rate} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CreateAddonRateForm() {
  const fetcher = useFetcher<RateActionData>();
  const [form, fields] = useForm({
    id: "create-addon-rate-form",
    lastResult: fetcher.data?.intent === "create-addon" ? fetcher.data.submission : undefined,
    constraint: getZodConstraint(addonRateFormSchema),
    shouldValidate: "onSubmit",
    shouldRevalidate: "onInput",
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: addonRateFormSchema });
    },
  });

  return (
    <fetcher.Form method="post" aria-label="Create add-on rate" {...getFormProps(form)}>
      <input type="hidden" name="intent" value="create-addon" />
      <div className="flex flex-col gap-5">
        <Field>
          <FieldTitle>Add-on type</FieldTitle>
          <p className="text-sm">Security detail</p>
        </Field>
        <Field data-invalid={Boolean(fields.rateAmount.errors)}>
          <FieldLabel htmlFor={fields.rateAmount.id}>Rate amount (NGN)</FieldLabel>
          <Input
            {...getInputProps(fields.rateAmount, { type: "number" })}
            autoComplete="off"
            min={0}
            step="any"
            inputMode="decimal"
            placeholder="Enter amount…"
          />
          <FieldError id={fields.rateAmount.errorId}>
            {fields.rateAmount.errors?.join(", ")}
          </FieldError>
        </Field>
        <RateWindowFields fields={fields} />
        {fetcher.data?.intent === "create-addon" && (fetcher.data.error || fetcher.data.success) ? (
          <Alert variant={fetcher.data.error ? "destructive" : "default"}>
            <AlertTitle>{fetcher.data.error ? "Rate not saved" : "Rate saved"}</AlertTitle>
            <AlertDescription>{fetcher.data.error ?? fetcher.data.success}</AlertDescription>
          </Alert>
        ) : null}
        <Button type="submit" disabled={fetcher.state !== "idle"}>
          {fetcher.state === "idle" ? "Create add-on rate" : "Creating…"}
        </Button>
      </div>
    </fetcher.Form>
  );
}

export function AdminAddonRatesPage({
  now,
  rates,
}: {
  readonly now: string;
  readonly rates: AddonRate[];
}) {
  return (
    <section
      aria-labelledby="addon-rates-heading"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6"
    >
      <div>
        <h2 id="addon-rates-heading" className="text-2xl font-semibold tracking-tight">
          Add-on rates
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage the flat security detail rate returned by the API.
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.2fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Create add-on rate</CardTitle>
            <CardDescription>
              New effective windows cannot overlap an existing security detail rate.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateAddonRateForm />
          </CardContent>
        </Card>

        <section aria-label="Add-on rate history" className="flex flex-col gap-3">
          {rates.length > 0 ? (
            rates.map((rate) => <AddonRateCard key={rate.id} now={now} rate={rate} />)
          ) : (
            <Empty className="border">
              <EmptyHeader>
                <EmptyTitle>No add-on rates</EmptyTitle>
                <EmptyDescription>Create the first security detail rate.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </section>
      </div>
    </section>
  );
}
