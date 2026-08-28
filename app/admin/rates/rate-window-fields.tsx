import { type FieldMetadata, getInputProps } from "@conform-to/react";

import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";

type RateWindowFieldset = {
  readonly effectiveSince: FieldMetadata<string>;
  readonly effectiveUntil: FieldMetadata<unknown>;
  readonly description: FieldMetadata<unknown>;
};

export function RateWindowFields({ fields }: { readonly fields: RateWindowFieldset }) {
  return (
    <FieldGroup>
      <Field data-invalid={Boolean(fields.effectiveSince.errors)}>
        <FieldLabel htmlFor={fields.effectiveSince.id}>Effective from</FieldLabel>
        <Input
          {...getInputProps(fields.effectiveSince, { type: "datetime-local" })}
          autoComplete="off"
        />
        <FieldDescription>Enter date and time in UTC.</FieldDescription>
        <FieldError id={fields.effectiveSince.errorId}>
          {fields.effectiveSince.errors?.join(", ")}
        </FieldError>
      </Field>

      <Field data-invalid={Boolean(fields.effectiveUntil.errors)}>
        <FieldLabel htmlFor={fields.effectiveUntil.id}>Effective until (optional)</FieldLabel>
        <Input
          {...getInputProps(fields.effectiveUntil, { type: "datetime-local" })}
          autoComplete="off"
        />
        <FieldError id={fields.effectiveUntil.errorId}>
          {fields.effectiveUntil.errors?.join(", ")}
        </FieldError>
      </Field>

      <Field data-invalid={Boolean(fields.description.errors)}>
        <FieldLabel htmlFor={fields.description.id}>Description (optional)</FieldLabel>
        <Input
          {...getInputProps(fields.description, { type: "text" })}
          autoComplete="off"
          maxLength={500}
          placeholder="Why this rate applies…"
        />
        <FieldError id={fields.description.errorId}>
          {fields.description.errors?.join(", ")}
        </FieldError>
      </Field>
    </FieldGroup>
  );
}
