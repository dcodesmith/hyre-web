import { getInputProps, useForm } from "@conform-to/react";

import type { FleetOwnerBank } from "~/api/fleet/onboarding/schema";
import { Field, FieldDescription, FieldError, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import type {
  OnboardingAccountFormInput,
  OnboardingAccountFormValue,
} from "./onboarding-form-schema";

export type OnboardingAccountFields = ReturnType<
  typeof useForm<OnboardingAccountFormInput, OnboardingAccountFormValue>
>[1];

export function AccountTypeFields({
  fields,
  onChange,
}: {
  readonly fields: OnboardingAccountFields;
  readonly onChange: (value: "INDIVIDUAL" | "BUSINESS") => void;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">Account type</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {(["INDIVIDUAL", "BUSINESS"] as const).map((value) => (
          <label
            key={value}
            className="flex cursor-pointer items-center gap-3 rounded-lg border p-4 has-checked:border-primary has-checked:bg-primary/5"
          >
            <input
              {...getInputProps(fields.accountType, { type: "radio", value })}
              onChange={() => onChange(value)}
            />
            <span className="text-sm font-medium">
              {value === "INDIVIDUAL" ? "Individual" : "Business"}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function BusinessFields({ fields }: { readonly fields: OnboardingAccountFields }) {
  return (
    <>
      <Field data-invalid={Boolean(fields.businessName.errors)}>
        <FieldLabel htmlFor={fields.businessName.id}>Registered business name</FieldLabel>
        <Input
          {...getInputProps(fields.businessName, { type: "text" })}
          autoComplete="organization"
          aria-invalid={fields.businessName.errors ? true : undefined}
        />
        <FieldError
          id={fields.businessName.errorId}
          errors={fields.businessName.errors?.map((message) => ({ message }))}
        />
      </Field>
      <Field data-invalid={Boolean(fields.registrationNumber.errors)}>
        <FieldLabel htmlFor={fields.registrationNumber.id}>Registration number</FieldLabel>
        <Input
          {...getInputProps(fields.registrationNumber, { type: "text" })}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={fields.registrationNumber.errors ? true : undefined}
        />
        <FieldError
          id={fields.registrationNumber.errorId}
          errors={fields.registrationNumber.errors?.map((message) => ({ message }))}
        />
      </Field>
      <Field data-invalid={Boolean(fields.registrationType.errors)}>
        <FieldLabel htmlFor={fields.registrationType.id}>Registration type</FieldLabel>
        <select
          id={fields.registrationType.id}
          name={fields.registrationType.name}
          defaultValue={fields.registrationType.initialValue ?? ""}
          className="h-10 w-full min-w-0 rounded-md border bg-background px-3 text-foreground text-sm"
          aria-invalid={fields.registrationType.errors ? true : undefined}
        >
          <option value="" disabled>
            Select type
          </option>
          {["RC", "BN", "IT", "LP", "LLP"].map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        <FieldError
          id={fields.registrationType.errorId}
          errors={fields.registrationType.errors?.map((message) => ({ message }))}
        />
      </Field>
    </>
  );
}

export function BankFields({
  banks,
  fields,
  onChange,
}: {
  readonly banks: FleetOwnerBank[];
  readonly fields: OnboardingAccountFields;
  readonly onChange: (bankCode: string) => void;
}) {
  return (
    <>
      <Field data-invalid={Boolean(fields.bankCode.errors)}>
        <FieldLabel htmlFor={fields.bankCode.id}>Bank</FieldLabel>
        <select
          id={fields.bankCode.id}
          name={fields.bankCode.name}
          defaultValue={fields.bankCode.initialValue ?? ""}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-full min-w-0 rounded-md border bg-background px-3 text-foreground text-sm"
          aria-invalid={fields.bankCode.errors ? true : undefined}
        >
          <option value="" disabled>
            Select your bank
          </option>
          {banks.map((bank) => (
            <option key={bank.code} value={bank.code}>
              {bank.name}
            </option>
          ))}
        </select>
        <FieldError
          id={fields.bankCode.errorId}
          errors={fields.bankCode.errors?.map((message) => ({ message }))}
        />
      </Field>
      <Field data-invalid={Boolean(fields.accountNumber.errors)}>
        <FieldLabel htmlFor={fields.accountNumber.id}>Account number</FieldLabel>
        <Input
          {...getInputProps(fields.accountNumber, { type: "text" })}
          inputMode="numeric"
          maxLength={10}
          autoComplete="off"
          aria-invalid={fields.accountNumber.errors ? true : undefined}
        />
        <FieldError
          id={fields.accountNumber.errorId}
          errors={fields.accountNumber.errors?.map((message) => ({ message }))}
        />
      </Field>
    </>
  );
}

export function OwnerDriverFields({
  fields,
  isOwnerDriver,
  onChange,
}: {
  readonly fields: OnboardingAccountFields;
  readonly isOwnerDriver: boolean;
  readonly onChange: (value: boolean) => void;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">Will you drive this car yourself?</legend>
      <div className="flex gap-4">
        {[
          ["true", "Yes"],
          ["false", "No"],
        ].map(([value, label]) => (
          <label
            key={value}
            className="flex touch-manipulation items-center gap-2 rounded-md px-3 py-2 text-sm"
          >
            <input
              name={fields.isOwnerDriver.name}
              type="radio"
              value={value}
              defaultChecked={isOwnerDriver === (value === "true")}
              onChange={() => onChange(value === "true")}
            />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function DriverDocumentFields({ fields }: { readonly fields: OnboardingAccountFields }) {
  return (
    <div className="grid gap-5 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2">
      <Field data-invalid={Boolean(fields.driversLicense.errors)}>
        <FieldLabel htmlFor={fields.driversLicense.id}>Driver&apos;s licence</FieldLabel>
        <Input
          {...getInputProps(fields.driversLicense, { type: "file" })}
          accept="image/jpeg,image/png,image/webp,application/pdf"
          aria-invalid={fields.driversLicense.errors ? true : undefined}
        />
        <FieldDescription>Required. JPEG, PNG, WebP, or PDF under 5&nbsp;MB.</FieldDescription>
        <FieldError
          id={fields.driversLicense.errorId}
          errors={fields.driversLicense.errors?.map((message) => ({ message }))}
        />
      </Field>
      <Field data-invalid={Boolean(fields.lasdri.errors)}>
        <FieldLabel htmlFor={fields.lasdri.id}>LASDRI card</FieldLabel>
        <Input
          {...getInputProps(fields.lasdri, { type: "file" })}
          accept="image/jpeg,image/png,image/webp,application/pdf"
          aria-invalid={fields.lasdri.errors ? true : undefined}
        />
        <FieldDescription>Optional. JPEG, PNG, WebP, or PDF under 5&nbsp;MB.</FieldDescription>
        <FieldError
          id={fields.lasdri.errorId}
          errors={fields.lasdri.errors?.map((message) => ({ message }))}
        />
      </Field>
    </div>
  );
}
