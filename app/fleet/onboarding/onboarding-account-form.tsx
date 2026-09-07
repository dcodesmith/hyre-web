import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { useState } from "react";
import { Form, useNavigation } from "react-router";

import type { FleetOwnerBank } from "~/api/fleet/onboarding/schema";
import { FormError } from "~/components/forms/form-primitives";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Field, FieldError, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import {
  AccountTypeFields,
  BankFields,
  BusinessFields,
  DriverDocumentFields,
  OwnerDriverFields,
} from "./onboarding-account-fields";
import {
  type OnboardingAccountFormInput,
  type OnboardingAccountFormValue,
  type OnboardingActionData,
  onboardingAccountFormSchema,
} from "./onboarding-form-schema";

type AccountFormProps = {
  readonly actionData?: OnboardingActionData;
  readonly banks: FleetOwnerBank[];
  readonly idempotencyKey: string;
};

function initialAccountType(actionData?: OnboardingActionData) {
  return actionData?.intent === "verify-account" &&
    actionData.submission?.initialValue?.accountType === "BUSINESS"
    ? "BUSINESS"
    : "INDIVIDUAL";
}

function initialOwnerDriver(actionData?: OnboardingActionData) {
  return (
    actionData?.intent === "verify-account" &&
    actionData.submission?.initialValue?.isOwnerDriver === "true"
  );
}

export function OnboardingAccountForm({ actionData, banks, idempotencyKey }: AccountFormProps) {
  const navigation = useNavigation();
  const pending =
    navigation.formMethod != null && navigation.formData?.get("intent") === "verify-account";
  const accountTypeDefault = initialAccountType(actionData);
  const ownerDriverDefault = initialOwnerDriver(actionData);
  const initialBankCode =
    actionData?.intent === "verify-account" &&
    typeof actionData.submission?.initialValue?.bankCode === "string"
      ? actionData.submission.initialValue.bankCode
      : "";
  const [accountType, setAccountType] = useState<"INDIVIDUAL" | "BUSINESS">(accountTypeDefault);
  const [isOwnerDriver, setIsOwnerDriver] = useState(ownerDriverDefault);
  const [bankCode, setBankCode] = useState(initialBankCode);
  const bankName = banks.find((bank) => bank.code === bankCode)?.name ?? "";
  const [form, fields] = useForm<OnboardingAccountFormInput, OnboardingAccountFormValue>({
    id: "fleet-owner-account",
    lastResult: actionData?.intent === "verify-account" ? actionData.submission : null,
    constraint: getZodConstraint(onboardingAccountFormSchema),
    defaultValue: {
      accountType: accountTypeDefault,
      isOwnerDriver: ownerDriverDefault ? "true" : "false",
    },
    shouldValidate: "onSubmit",
    shouldRevalidate: "onInput",
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: onboardingAccountFormSchema });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Identity &amp; Payout Details</h2>
        </CardTitle>
        <CardDescription>
          Your identity and bank account name must match. Business accounts are checked against CAC.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form
          method="post"
          encType="multipart/form-data"
          {...getFormProps(form)}
          className="space-y-6"
        >
          <input type="hidden" name="intent" value="verify-account" />
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
          <input type="hidden" name="bankName" value={bankName} />

          <AccountTypeFields fields={fields} onChange={setAccountType} />

          <div className="grid gap-5 sm:grid-cols-2">
            <Field data-invalid={Boolean(fields.nin.errors)}>
              <FieldLabel htmlFor={fields.nin.id}>National Identification Number</FieldLabel>
              <Input
                {...getInputProps(fields.nin, { type: "text" })}
                inputMode="numeric"
                maxLength={11}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={fields.nin.errors ? true : undefined}
              />
              <FieldError
                id={fields.nin.errorId}
                errors={fields.nin.errors?.map((message) => ({ message }))}
              />
            </Field>
            {accountType === "BUSINESS" ? <BusinessFields fields={fields} /> : null}
            <BankFields banks={banks} fields={fields} onChange={setBankCode} />
          </div>

          <OwnerDriverFields
            fields={fields}
            isOwnerDriver={isOwnerDriver}
            onChange={setIsOwnerDriver}
          />
          {isOwnerDriver ? <DriverDocumentFields fields={fields} /> : null}

          <FormError id={form.errorId} errors={form.errors} />
          {actionData?.intent === "verify-account" && actionData.error ? (
            <FormError id="verify-account-error" errors={[actionData.error]} />
          ) : null}
          <Button type="submit" disabled={pending} aria-live="polite">
            {pending ? "Verifying account…" : "Submit verification"}
          </Button>
        </Form>
      </CardContent>
    </Card>
  );
}
