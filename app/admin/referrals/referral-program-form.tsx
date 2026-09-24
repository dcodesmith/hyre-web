import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { useState } from "react";
import { useFetcher } from "react-router";
import type { ReferralProgram } from "~/api/admin/referrals/schema";
import { BOOKING_TYPE_OPTIONS, BOOKING_TYPE_OPTIONS_MAP } from "~/booking/types";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  type ReferralProgramActionData,
  referralProgramFormSchema,
} from "./referral-program-form-schema";

type IncentiveType = "FIXED" | "PERCENTAGE";

function incentiveDefaults(incentive: ReferralProgram["refereeDiscount"] | undefined) {
  if (!incentive) {
    return { type: "FIXED" as const };
  }

  return incentive.type === "FIXED"
    ? { type: incentive.type, amount: incentive.amount }
    : {
        type: incentive.type,
        percentage: incentive.percentage,
        maxAmount: incentive.maxAmount,
      };
}

function programDefaults(program: ReferralProgram | null) {
  const referee = incentiveDefaults(program?.refereeDiscount);
  const referrer = incentiveDefaults(program?.referrerReward);
  const numberValue = (value: number | undefined) =>
    value === undefined ? undefined : String(value);

  return {
    refereeDiscountType: referee.type,
    refereeDiscountAmount: referee.type === "FIXED" ? numberValue(referee.amount) : undefined,
    refereeDiscountPercentage:
      referee.type === "PERCENTAGE" ? numberValue(referee.percentage) : undefined,
    refereeDiscountMaxAmount:
      referee.type === "PERCENTAGE" ? numberValue(referee.maxAmount) : undefined,
    referrerRewardType: referrer.type,
    referrerRewardAmount: referrer.type === "FIXED" ? numberValue(referrer.amount) : undefined,
    referrerRewardPercentage:
      referrer.type === "PERCENTAGE" ? numberValue(referrer.percentage) : undefined,
    referrerRewardMaxAmount:
      referrer.type === "PERCENTAGE" ? numberValue(referrer.maxAmount) : undefined,
    minimumBookingAmount: numberValue(program?.minimumBookingAmount),
    eligibleBookingTypes: program?.eligibleBookingTypes ?? [],
    referralValidityDays: numberValue(program?.referralValidityDays),
    maxCreditsPerBookingAmount: numberValue(program?.maxCreditsPerBookingAmount),
    maxCreditsPerBookingPercent: numberValue(program?.maxCreditsPerBookingPercent),
  };
}

type IncentiveFieldsProps = {
  readonly title: string;
  readonly description: string;
  readonly type: IncentiveType;
  readonly onTypeChange: (type: IncentiveType) => void;
  readonly typeField: {
    readonly id: string;
    readonly name: string;
    readonly errors?: string[];
  };
  readonly amountField: Parameters<typeof getInputProps>[0];
  readonly percentageField: Parameters<typeof getInputProps>[0];
  readonly maxAmountField: Parameters<typeof getInputProps>[0];
};

function IncentiveFields({
  title,
  description,
  type,
  onTypeChange,
  typeField,
  amountField,
  percentageField,
  maxAmountField,
}: IncentiveFieldsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 sm:grid-cols-2">
        <Field data-invalid={Boolean(typeField.errors)}>
          <FieldLabel htmlFor={typeField.id}>Incentive type</FieldLabel>
          <Select
            name={typeField.name}
            value={type}
            onValueChange={(value) => onTypeChange(value as IncentiveType)}
          >
            <SelectTrigger id={typeField.id} className="h-10 w-full rounded-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="FIXED">Fixed amount</SelectItem>
              <SelectItem value="PERCENTAGE">Percentage</SelectItem>
            </SelectContent>
          </Select>
          <FieldError>{typeField.errors?.join(", ")}</FieldError>
        </Field>

        {type === "FIXED" ? (
          <Field data-invalid={Boolean(amountField.errors)}>
            <FieldLabel htmlFor={amountField.id}>Amount (NGN)</FieldLabel>
            <Input
              {...getInputProps(amountField, { type: "number" })}
              className="h-10 rounded-sm"
              min={0.01}
              step="0.01"
              inputMode="decimal"
            />
            <FieldError>{amountField.errors?.join(", ")}</FieldError>
          </Field>
        ) : (
          <>
            <Field data-invalid={Boolean(percentageField.errors)}>
              <FieldLabel htmlFor={percentageField.id}>Percentage</FieldLabel>
              <Input
                {...getInputProps(percentageField, { type: "number" })}
                className="h-10 rounded-sm"
                min={0.01}
                max={100}
                step="0.01"
                inputMode="decimal"
              />
              <FieldError>{percentageField.errors?.join(", ")}</FieldError>
            </Field>
            <Field data-invalid={Boolean(maxAmountField.errors)} className="sm:col-start-2">
              <FieldLabel htmlFor={maxAmountField.id}>Maximum amount (NGN)</FieldLabel>
              <Input
                {...getInputProps(maxAmountField, { type: "number" })}
                className="h-10 rounded-sm"
                min={0.01}
                step="0.01"
                inputMode="decimal"
              />
              <FieldDescription>Caps the percentage-based incentive.</FieldDescription>
              <FieldError>{maxAmountField.errors?.join(", ")}</FieldError>
            </Field>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function ReferralProgramForm({ program }: { readonly program: ReferralProgram | null }) {
  const fetcher = useFetcher<ReferralProgramActionData>();
  const [refereeType, setRefereeType] = useState<IncentiveType>(
    program?.refereeDiscount.type ?? "FIXED",
  );
  const [referrerType, setReferrerType] = useState<IncentiveType>(
    program?.referrerReward.type ?? "FIXED",
  );
  const [form, fields] = useForm({
    id: "referral-program-form",
    lastResult: fetcher.data?.submission,
    constraint: getZodConstraint(referralProgramFormSchema),
    defaultValue: programDefaults(program),
    shouldValidate: "onSubmit",
    shouldRevalidate: "onInput",
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: referralProgramFormSchema });
    },
  });
  const intent = program ? "update" : "create";

  return (
    <fetcher.Form method="post" className="space-y-6" {...getFormProps(form)}>
      <input type="hidden" name="intent" value={intent} />
      <IncentiveFields
        title="New customer discount"
        description="Applied automatically to an eligible referred customer’s first booking."
        type={refereeType}
        onTypeChange={setRefereeType}
        typeField={fields.refereeDiscountType}
        amountField={fields.refereeDiscountAmount}
        percentageField={fields.refereeDiscountPercentage}
        maxAmountField={fields.refereeDiscountMaxAmount}
      />
      <IncentiveFields
        title="Referrer reward"
        description="Banked as booking credit after the referred customer completes their booking."
        type={referrerType}
        onTypeChange={setReferrerType}
        typeField={fields.referrerRewardType}
        amountField={fields.referrerRewardAmount}
        percentageField={fields.referrerRewardPercentage}
        maxAmountField={fields.referrerRewardMaxAmount}
      />

      <Card>
        <CardHeader>
          <CardTitle>Eligibility and credit use</CardTitle>
          <CardDescription>
            The API applies the lower credit cap when both amount and percentage limits are set.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <Field data-invalid={Boolean(fields.minimumBookingAmount.errors)}>
            <FieldLabel htmlFor={fields.minimumBookingAmount.id}>
              Minimum booking amount (NGN)
            </FieldLabel>
            <Input
              {...getInputProps(fields.minimumBookingAmount, { type: "number" })}
              className="h-10 rounded-sm"
              min={0.01}
              step="0.01"
              inputMode="decimal"
            />
            <FieldError>{fields.minimumBookingAmount.errors?.join(", ")}</FieldError>
          </Field>
          <Field data-invalid={Boolean(fields.referralValidityDays.errors)}>
            <FieldLabel htmlFor={fields.referralValidityDays.id}>
              Referral validity (days)
            </FieldLabel>
            <Input
              {...getInputProps(fields.referralValidityDays, { type: "number" })}
              className="h-10 rounded-sm"
              min={0}
              max={3650}
              step={1}
              inputMode="numeric"
            />
            <FieldDescription>Use 0 for no expiry.</FieldDescription>
            <FieldError>{fields.referralValidityDays.errors?.join(", ")}</FieldError>
          </Field>
          <Field data-invalid={Boolean(fields.maxCreditsPerBookingAmount.errors)}>
            <FieldLabel htmlFor={fields.maxCreditsPerBookingAmount.id}>
              Maximum credits per booking (NGN)
            </FieldLabel>
            <Input
              {...getInputProps(fields.maxCreditsPerBookingAmount, { type: "number" })}
              className="h-10 rounded-sm"
              min={0}
              step="0.01"
              inputMode="decimal"
            />
            <FieldError>{fields.maxCreditsPerBookingAmount.errors?.join(", ")}</FieldError>
          </Field>
          <Field data-invalid={Boolean(fields.maxCreditsPerBookingPercent.errors)}>
            <FieldLabel htmlFor={fields.maxCreditsPerBookingPercent.id}>
              Maximum credits per booking (%)
            </FieldLabel>
            <Input
              {...getInputProps(fields.maxCreditsPerBookingPercent, { type: "number" })}
              className="h-10 rounded-sm"
              min={0}
              max={100}
              step="0.01"
              inputMode="decimal"
            />
            <FieldError>{fields.maxCreditsPerBookingPercent.errors?.join(", ")}</FieldError>
          </Field>
          <fieldset className="sm:col-span-2">
            <legend className="text-sm font-medium">Eligible booking types</legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {BOOKING_TYPE_OPTIONS.map((bookingType) => (
                <label key={bookingType} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name={fields.eligibleBookingTypes.name}
                    value={bookingType}
                    defaultChecked={program?.eligibleBookingTypes.includes(bookingType)}
                    className="size-4 accent-primary"
                  />
                  {BOOKING_TYPE_OPTIONS_MAP[bookingType].label}
                </label>
              ))}
            </div>
            <FieldError className="mt-2">
              {fields.eligibleBookingTypes.errors?.join(", ")}
            </FieldError>
          </fieldset>
        </CardContent>
      </Card>

      {fetcher.data?.error || fetcher.data?.success ? (
        <Alert variant={fetcher.data.error ? "destructive" : "default"}>
          <AlertTitle>{fetcher.data.error ? "Programme not saved" : "Programme saved"}</AlertTitle>
          <AlertDescription>{fetcher.data.error ?? fetcher.data.success}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" disabled={fetcher.state !== "idle"}>
        {fetcher.state === "idle"
          ? program
            ? "Save programme"
            : "Create and activate programme"
          : "Saving…"}
      </Button>
    </fetcher.Form>
  );
}
