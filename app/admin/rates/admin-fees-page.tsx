import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { useFetcher } from "react-router";

import type { PlatformFeeRate, VatRate } from "~/api/admin/rates/schema";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Field, FieldError, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { platformFeeFormSchema, type RateActionData, vatRateFormSchema } from "./rate-form-schema";
import { RateWindowFields } from "./rate-window-fields";

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function formatRateDate(value: string) {
  return `${dateTimeFormatter.format(new Date(value))} UTC`;
}

function CurrentRate({
  label,
  rate,
}: {
  readonly label: string;
  readonly rate?: PlatformFeeRate | VatRate;
}) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-semibold tabular-nums">
        {rate ? `${rate.ratePercent}%` : "No active rate"}
      </dd>
      {rate ? (
        <dd className="mt-1 text-xs text-muted-foreground">
          Effective since {formatRateDate(rate.effectiveSince)}
        </dd>
      ) : null}
    </div>
  );
}

function getRateLabel(rate: PlatformFeeRate | VatRate) {
  if (!("feeType" in rate)) {
    return "VAT";
  }
  return rate.feeType === "PLATFORM_SERVICE_FEE"
    ? "Platform service fee"
    : "Fleet owner commission";
}

function RateHistory({ rates }: { readonly rates: readonly (PlatformFeeRate | VatRate)[] }) {
  return (
    <details className="rounded-lg border px-3 py-2">
      <summary className="cursor-pointer text-sm font-medium">
        Existing rate windows ({rates.length})
      </summary>
      {rates.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-3 border-t pt-3 text-sm">
          {rates.map((rate) => (
            <li key={rate.id} className="flex flex-wrap items-start justify-between gap-2">
              <span>
                {getRateLabel(rate)}: <strong className="tabular-nums">{rate.ratePercent}%</strong>
              </span>
              <span className="text-xs text-muted-foreground">
                {formatRateDate(rate.effectiveSince)} –{" "}
                {rate.effectiveUntil ? formatRateDate(rate.effectiveUntil) : "No end date"}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">No existing windows.</p>
      )}
    </details>
  );
}

function ActionFeedback({
  data,
  intent,
}: {
  readonly data?: RateActionData;
  readonly intent: RateActionData["intent"];
}) {
  if (data?.intent !== intent || (!data.error && !data.success)) {
    return null;
  }

  return (
    <Alert variant={data.error ? "destructive" : "default"}>
      <AlertTitle>{data.error ? "Rate not saved" : "Rate saved"}</AlertTitle>
      <AlertDescription>{data.error ?? data.success}</AlertDescription>
    </Alert>
  );
}

function VatRateForm() {
  const fetcher = useFetcher<RateActionData>();
  const [form, fields] = useForm({
    id: "vat-rate-form",
    lastResult: fetcher.data?.intent === "vat" ? fetcher.data.submission : undefined,
    constraint: getZodConstraint(vatRateFormSchema),
    shouldValidate: "onSubmit",
    shouldRevalidate: "onInput",
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: vatRateFormSchema });
    },
  });

  return (
    <fetcher.Form method="post" aria-label="Schedule VAT rate" {...getFormProps(form)}>
      <input type="hidden" name="intent" value="vat" />
      <div className="flex flex-col gap-5">
        <Field data-invalid={Boolean(fields.ratePercent.errors)}>
          <FieldLabel htmlFor={fields.ratePercent.id}>Rate percentage</FieldLabel>
          <Input
            {...getInputProps(fields.ratePercent, { type: "number" })}
            autoComplete="off"
            min={0}
            max={100}
            step="any"
            inputMode="decimal"
            placeholder="Enter percentage…"
          />
          <FieldError id={fields.ratePercent.errorId}>
            {fields.ratePercent.errors?.join(", ")}
          </FieldError>
        </Field>
        <RateWindowFields fields={fields} />
        <ActionFeedback data={fetcher.data} intent="vat" />
        <Button type="submit" disabled={fetcher.state !== "idle"}>
          {fetcher.state === "idle" ? "Save VAT rate" : "Saving…"}
        </Button>
      </div>
    </fetcher.Form>
  );
}

function PlatformFeeForm() {
  const fetcher = useFetcher<RateActionData>();
  const [form, fields] = useForm({
    id: "platform-fee-form",
    lastResult: fetcher.data?.intent === "platform-fee" ? fetcher.data.submission : undefined,
    constraint: getZodConstraint(platformFeeFormSchema),
    shouldValidate: "onSubmit",
    shouldRevalidate: "onInput",
    defaultValue: { feeType: "PLATFORM_SERVICE_FEE" },
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: platformFeeFormSchema });
    },
  });

  return (
    <fetcher.Form method="post" aria-label="Schedule platform fee" {...getFormProps(form)}>
      <input type="hidden" name="intent" value="platform-fee" />
      <div className="flex flex-col gap-5">
        <Field data-invalid={Boolean(fields.feeType.errors)}>
          <FieldLabel htmlFor={fields.feeType.id}>Fee type</FieldLabel>
          <Select
            key={fields.feeType.key}
            name={fields.feeType.name}
            defaultValue={fields.feeType.initialValue ?? "PLATFORM_SERVICE_FEE"}
          >
            <SelectTrigger
              id={fields.feeType.id}
              className="w-full"
              aria-invalid={fields.feeType.errors ? true : undefined}
              aria-describedby={fields.feeType.errors ? fields.feeType.errorId : undefined}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="PLATFORM_SERVICE_FEE">Platform service fee</SelectItem>
                <SelectItem value="FLEET_OWNER_COMMISSION">Fleet owner commission</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <FieldError id={fields.feeType.errorId}>{fields.feeType.errors?.join(", ")}</FieldError>
        </Field>
        <Field data-invalid={Boolean(fields.ratePercent.errors)}>
          <FieldLabel htmlFor={fields.ratePercent.id}>Rate percentage</FieldLabel>
          <Input
            {...getInputProps(fields.ratePercent, { type: "number" })}
            autoComplete="off"
            min={0}
            max={100}
            step="any"
            inputMode="decimal"
            placeholder="Enter percentage…"
          />
          <FieldError id={fields.ratePercent.errorId}>
            {fields.ratePercent.errors?.join(", ")}
          </FieldError>
        </Field>
        <RateWindowFields fields={fields} />
        <ActionFeedback data={fetcher.data} intent="platform-fee" />
        <Button type="submit" disabled={fetcher.state !== "idle"}>
          {fetcher.state === "idle" ? "Save platform fee" : "Saving…"}
        </Button>
      </div>
    </fetcher.Form>
  );
}

export function AdminFeesPage({
  platformFeeRates,
  taxRates,
}: {
  readonly platformFeeRates: PlatformFeeRate[];
  readonly taxRates: VatRate[];
}) {
  const currentVat = taxRates.find((rate) => rate.active);
  const currentServiceFee = platformFeeRates.find(
    (rate) => rate.active && rate.feeType === "PLATFORM_SERVICE_FEE",
  );
  const currentCommission = platformFeeRates.find(
    (rate) => rate.active && rate.feeType === "FLEET_OWNER_COMMISSION",
  );

  return (
    <section
      aria-labelledby="fees-heading"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6"
    >
      <div>
        <h2 id="fees-heading" className="text-2xl font-semibold tracking-tight">
          Fees and VAT
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Schedule non-overlapping percentage rates. Existing rate windows are enforced by the API.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>VAT rate</CardTitle>
            <CardDescription>Set the VAT percentage for a future effective window.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <dl className="rounded-lg bg-muted/50 p-3">
              <CurrentRate label="Current VAT rate" rate={currentVat} />
            </dl>
            <RateHistory rates={taxRates} />
            <VatRateForm />
          </CardContent>
          <CardFooter className="text-xs text-muted-foreground">
            Percentage values must be between 0 and 100.
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Platform fees</CardTitle>
            <CardDescription>
              Set the customer service fee or fleet owner commission.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <dl className="grid gap-3 rounded-lg bg-muted/50 p-3 sm:grid-cols-2">
              <CurrentRate label="Customer service fee" rate={currentServiceFee} />
              <CurrentRate label="Fleet owner commission" rate={currentCommission} />
            </dl>
            <RateHistory rates={platformFeeRates} />
            <PlatformFeeForm />
          </CardContent>
          <CardFooter className="text-xs text-muted-foreground">
            New windows cannot overlap an existing rate of the same type.
          </CardFooter>
        </Card>
      </div>
    </section>
  );
}
