import { type FieldMetadata, getInputProps } from "@conform-to/react";
import type { FleetOwnerBank } from "~/api/fleet/onboarding/schema";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "~/components/ui/combobox";
import { Field, FieldDescription, FieldError, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { OnboardingLicenseUploadField } from "./onboarding-driving-fields";

const selectClassName =
  "h-10 w-full min-w-0 rounded-sm border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30";

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
    <fieldset>
      <legend className="sr-only">Account type</legend>
      <div className="flex flex-wrap items-center gap-5 py-1">
        {(["INDIVIDUAL", "BUSINESS"] as const).map((value) => (
          <label
            key={value}
            className="flex cursor-pointer touch-manipulation items-center gap-2.5 text-sm font-medium text-foreground"
          >
            <input
              {...getInputProps(field, { type: "radio", value })}
              className="size-4 accent-foreground"
              onChange={() => onChange(value)}
            />
            <span>{value === "INDIVIDUAL" ? "Individual" : "Business"}</span>
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
      <FieldLabel htmlFor={field.id}>National Identification Number</FieldLabel>
      <Input
        {...getInputProps(field, { type: "text" })}
        className="h-10 rounded-sm"
        placeholder="Enter 11 digit NIN"
        inputMode="numeric"
        maxLength={11}
        autoComplete="off"
        spellCheck={false}
        aria-invalid={field.errors ? true : undefined}
      />
      {accountType === "BUSINESS" ? (
        <FieldDescription className="text-xs">
          Enter the company representative&apos;s 11-digit NIN.
        </FieldDescription>
      ) : null}
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
          placeholder="Enter business name"
          autoComplete="organization"
          aria-invalid={businessName.errors ? true : undefined}
        />
        <FieldError
          id={businessName.errorId}
          errors={businessName.errors?.map((message) => ({ message }))}
        />
      </Field>

      <div className="grid grid-cols-2 items-start gap-4 sm:gap-5">
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
              Select
            </option>
            {CAC_REGISTRATION_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
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
            placeholder="Enter reg no"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={registrationNumber.errors ? true : undefined}
          />
          <FieldError
            id={registrationNumber.errorId}
            errors={registrationNumber.errors?.map((message) => ({ message }))}
          />
        </Field>
      </div>
    </>
  );
}

function BankCombobox({
  banks,
  field,
}: {
  readonly banks: readonly FleetOwnerBank[];
  readonly field: FieldMetadata<string>;
}) {
  const initial = typeof field.initialValue === "string" ? field.initialValue : "";

  return (
    <Combobox
      items={banks}
      defaultValue={banks.find((bank) => bank.code === initial) ?? null}
      itemToStringLabel={(bank) => bank.name}
      itemToStringValue={(bank) => bank.code}
      isItemEqualToValue={(left, right) => left.code === right.code}
      name={field.name}
      id={field.id}
      autoHighlight
      autoComplete="off"
      filter={(bank, query) => {
        const normalized = query.trim().toLocaleLowerCase();
        return (
          bank.name.toLocaleLowerCase().includes(normalized) ||
          bank.code.toLocaleLowerCase().includes(normalized)
        );
      }}
    >
      <ComboboxInput
        placeholder="Search your bank"
        aria-invalid={field.errors ? true : undefined}
        aria-describedby={field.errors ? field.errorId : undefined}
        className="h-10 w-full rounded-sm"
      />
      <ComboboxContent>
        <ComboboxEmpty>No bank found.</ComboboxEmpty>
        <ComboboxList>
          {(bank) => (
            <ComboboxItem key={bank.code} value={bank}>
              {bank.name}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
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
    <div className="flex flex-col gap-5">
      <Field data-invalid={Boolean(bankCode.errors)}>
        <FieldLabel htmlFor={bankCode.id}>Bank Name</FieldLabel>
        <BankCombobox banks={banks} field={bankCode} />
        <FieldError
          id={bankCode.errorId}
          errors={bankCode.errors?.map((message) => ({ message }))}
        />
      </Field>
      <Field data-invalid={Boolean(accountNumber.errors)}>
        <FieldLabel htmlFor={accountNumber.id}>Account Number</FieldLabel>
        <Input
          {...getInputProps(accountNumber, { type: "text" })}
          className="h-10 rounded-sm"
          placeholder="Enter account number"
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
    <fieldset>
      <legend className="sr-only">Will you drive this car yourself?</legend>
      <div className="flex flex-wrap items-center gap-5 py-1">
        {[
          ["true", "Yes"],
          ["false", "No"],
        ].map(([value, label]) => (
          <label
            key={value}
            className="flex cursor-pointer touch-manipulation items-center gap-2.5 text-sm font-medium text-foreground"
          >
            <input
              name={field.name}
              type="radio"
              value={value}
              className="size-4 accent-foreground"
              defaultChecked={isOwnerDriver === (value === "true")}
              onChange={() => onChange(value === "true")}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function DriverDocumentFields({
  driversLicenseNumber,
  driversLicense,
}: {
  readonly driversLicenseNumber: FieldMetadata<string | undefined>;
  readonly driversLicense: FieldMetadata<File | undefined>;
}) {
  return (
    <div className="flex flex-col gap-5">
      <Field data-invalid={Boolean(driversLicenseNumber.errors)}>
        <FieldLabel htmlFor={driversLicenseNumber.id}>Driver&apos;s license number</FieldLabel>
        <Input
          {...getInputProps(driversLicenseNumber, { type: "text" })}
          className="h-10 rounded-sm"
          placeholder="Enter license number"
          autoComplete="off"
          maxLength={30}
          spellCheck={false}
          aria-invalid={driversLicenseNumber.errors ? true : undefined}
        />
        <FieldError
          id={driversLicenseNumber.errorId}
          errors={driversLicenseNumber.errors?.map((message) => ({ message }))}
        />
      </Field>
      <OnboardingLicenseUploadField field={driversLicense} label="Upload license" />
    </div>
  );
}
