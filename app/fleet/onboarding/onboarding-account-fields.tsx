import { type FieldMetadata, getInputProps } from "@conform-to/react";

import type { FleetOwnerBank } from "~/api/fleet/onboarding/schema";
import { Field, FieldDescription, FieldError, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";

const selectClassName =
  "h-10 w-full min-w-0 rounded-sm border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30";

const CAC_REGISTRATION_TYPES = [
  { value: "RC", label: "Registered Company (RC)" },
  { value: "BN", label: "Business Name (BN)" },
  { value: "IT", label: "Incorporated Trustees (IT)" },
  { value: "LP", label: "Limited Partnership (LP)" },
  { value: "LLP", label: "Limited Liability Partnership (LLP)" },
] as const;

export function AccountTypeFields({
  field,
  onChange,
}: {
  readonly field: FieldMetadata<"INDIVIDUAL" | "BUSINESS">;
  readonly onChange: (value: "INDIVIDUAL" | "BUSINESS") => void;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">Account type</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {(["INDIVIDUAL", "BUSINESS"] as const).map((value) => (
          <label
            key={value}
            className="flex cursor-pointer items-center gap-3 rounded-sm border p-4 has-checked:border-primary has-checked:bg-primary/5"
          >
            <input
              {...getInputProps(field, { type: "radio", value })}
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

export function NinField({
  field,
  accountType,
}: {
  readonly field: FieldMetadata<string>;
  readonly accountType: "INDIVIDUAL" | "BUSINESS";
}) {
  return (
    <Field data-invalid={Boolean(field.errors)}>
      <FieldLabel htmlFor={field.id}>
        {accountType === "BUSINESS"
          ? "Representative's National Identification Number"
          : "National Identification Number"}
      </FieldLabel>
      <Input
        {...getInputProps(field, { type: "text" })}
        className="h-10 rounded-sm"
        inputMode="numeric"
        maxLength={11}
        autoComplete="off"
        spellCheck={false}
        aria-invalid={field.errors ? true : undefined}
      />
      <FieldError id={field.errorId} errors={field.errors?.map((message) => ({ message }))} />
    </Field>
  );
}

export function BusinessFields({
  businessName,
  registrationNumber,
  registrationType,
}: {
  readonly businessName: FieldMetadata<string>;
  readonly registrationNumber: FieldMetadata<string>;
  readonly registrationType: FieldMetadata<string>;
}) {
  return (
    <>
      <Field data-invalid={Boolean(businessName.errors)}>
        <FieldLabel htmlFor={businessName.id}>Registered business name</FieldLabel>
        <Input
          {...getInputProps(businessName, { type: "text" })}
          className="h-10 rounded-sm"
          autoComplete="organization"
          aria-invalid={businessName.errors ? true : undefined}
        />
        <FieldError
          id={businessName.errorId}
          errors={businessName.errors?.map((message) => ({ message }))}
        />
      </Field>

      <Field data-invalid={Boolean(registrationType.errors)}>
        <FieldLabel htmlFor={registrationType.id}>CAC registration type</FieldLabel>
        <select
          id={registrationType.id}
          name={registrationType.name}
          defaultValue={
            typeof registrationType.initialValue === "string" ? registrationType.initialValue : ""
          }
          className={selectClassName}
          aria-invalid={registrationType.errors ? true : undefined}
          aria-describedby={registrationType.errors ? registrationType.errorId : undefined}
        >
          <option value="" disabled>
            Select type
          </option>
          {CAC_REGISTRATION_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
        <FieldDescription>
          Select the category shown on your CAC registration certificate.
        </FieldDescription>
        <FieldError
          id={registrationType.errorId}
          errors={registrationType.errors?.map((message) => ({ message }))}
        />
      </Field>

      <Field data-invalid={Boolean(registrationNumber.errors)}>
        <FieldLabel htmlFor={registrationNumber.id}>CAC registration number</FieldLabel>
        <Input
          {...getInputProps(registrationNumber, { type: "text" })}
          className="h-10 rounded-sm"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={registrationNumber.errors ? true : undefined}
        />
        <FieldError
          id={registrationNumber.errorId}
          errors={registrationNumber.errors?.map((message) => ({ message }))}
        />
      </Field>
    </>
  );
}

export function BankFields({
  banks,
  bankCode,
  accountNumber,
}: {
  readonly banks: FleetOwnerBank[];
  readonly bankCode: FieldMetadata<string>;
  readonly accountNumber: FieldMetadata<string>;
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field data-invalid={Boolean(bankCode.errors)}>
        <FieldLabel htmlFor={bankCode.id}>Bank</FieldLabel>
        <select
          id={bankCode.id}
          name={bankCode.name}
          defaultValue={typeof bankCode.initialValue === "string" ? bankCode.initialValue : ""}
          className={selectClassName}
          aria-invalid={bankCode.errors ? true : undefined}
          aria-describedby={bankCode.errors ? bankCode.errorId : undefined}
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
          id={bankCode.errorId}
          errors={bankCode.errors?.map((message) => ({ message }))}
        />
      </Field>
      <Field data-invalid={Boolean(accountNumber.errors)}>
        <FieldLabel htmlFor={accountNumber.id}>Account number</FieldLabel>
        <Input
          {...getInputProps(accountNumber, { type: "text" })}
          className="h-10 rounded-sm"
          inputMode="numeric"
          maxLength={10}
          autoComplete="off"
          aria-invalid={accountNumber.errors ? true : undefined}
        />
        <FieldError
          id={accountNumber.errorId}
          errors={accountNumber.errors?.map((message) => ({ message }))}
        />
      </Field>
    </div>
  );
}

export function OwnerDriverFields({
  field,
  isOwnerDriver,
  onChange,
}: {
  readonly field: FieldMetadata<boolean | "true" | "false">;
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
            className="flex touch-manipulation items-center gap-2 rounded-sm px-3 py-2 text-sm"
          >
            <input
              name={field.name}
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

export function DriverDocumentFields({
  driversLicense,
  lasdri,
}: {
  readonly driversLicense: FieldMetadata<File | undefined>;
  readonly lasdri: FieldMetadata<File | undefined>;
}) {
  return (
    <div className="grid gap-5 rounded-sm border bg-muted/30 p-4 sm:grid-cols-2">
      <Field data-invalid={Boolean(driversLicense.errors)}>
        <FieldLabel htmlFor={driversLicense.id}>Driver&apos;s licence</FieldLabel>
        <Input
          {...getInputProps(driversLicense, { type: "file" })}
          className="h-10 rounded-sm"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          aria-invalid={driversLicense.errors ? true : undefined}
        />
        <FieldDescription>Required. JPEG, PNG, WebP, or PDF under 5&nbsp;MB.</FieldDescription>
        <FieldError
          id={driversLicense.errorId}
          errors={driversLicense.errors?.map((message) => ({ message }))}
        />
      </Field>
      <Field data-invalid={Boolean(lasdri.errors)}>
        <FieldLabel htmlFor={lasdri.id}>LASDRI card</FieldLabel>
        <Input
          {...getInputProps(lasdri, { type: "file" })}
          className="h-10 rounded-sm"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          aria-invalid={lasdri.errors ? true : undefined}
        />
        <FieldDescription>Optional. JPEG, PNG, WebP, or PDF under 5&nbsp;MB.</FieldDescription>
        <FieldError id={lasdri.errorId} errors={lasdri.errors?.map((message) => ({ message }))} />
      </Field>
    </div>
  );
}
