import { type FieldMetadata, getInputProps } from "@conform-to/react";

import { FormError } from "~/components/forms/form-primitives";
import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";

type GuestFields = {
  readonly name: FieldMetadata<string>;
  readonly email: FieldMetadata<string>;
  readonly phoneNumber: FieldMetadata<string>;
};

function GuestTextField({
  field,
  label,
  type,
  autoComplete,
  placeholder,
}: {
  readonly field: FieldMetadata<string>;
  readonly label: string;
  readonly type: "text" | "email" | "tel";
  readonly autoComplete: string;
  readonly placeholder: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={field.id} className="block font-semibold leading-5">
        {label}
      </Label>
      <input
        {...getInputProps(field, { type })}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
          field.errors && "border-red-500",
        )}
      />
      <FormError id={field.errorId} errors={field.errors} />
    </div>
  );
}

export function BookingGuestFields({ fields }: { readonly fields: GuestFields }) {
  return (
    <div className="space-y-4 rounded border border-neutral-200 bg-white px-4 py-4 shadow-xl inset-shadow-sm transform-gpu lg:rounded-none lg:border-none lg:bg-transparent lg:px-0 lg:py-0 lg:shadow-none lg:inset-shadow-none">
      <GuestTextField
        field={fields.name}
        label="Name"
        type="text"
        autoComplete="name"
        placeholder="Enter your full name"
      />
      <GuestTextField
        field={fields.email}
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="Enter your email"
      />
      <GuestTextField
        field={fields.phoneNumber}
        label="Phone Number"
        type="tel"
        autoComplete="tel"
        placeholder="Enter your phone number"
      />
    </div>
  );
}
