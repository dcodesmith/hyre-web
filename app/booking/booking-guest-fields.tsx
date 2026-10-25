import { type FieldMetadata, getInputProps } from "@conform-to/react";
import { cn } from "cn";

import { bookingPhoneInputClassName } from "~/booking/booking-phone-verification";
import { FormError } from "~/components/forms/form-primitives";
import { Label } from "~/components/ui/label";

type GuestFields = {
  readonly name: FieldMetadata<string>;
  readonly email: FieldMetadata<string>;
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
        className={cn(bookingPhoneInputClassName, field.errors && "border-red-500")}
      />
      <FormError id={field.errorId} errors={field.errors} />
    </div>
  );
}

export function BookingGuestFields({ fields }: { readonly fields: GuestFields }) {
  return (
    <div className="space-y-4">
      <GuestTextField
        field={fields.name}
        label="Full Name"
        type="text"
        autoComplete="name"
        placeholder="Enter your full name"
      />
      <GuestTextField
        field={fields.email}
        label="Email Address"
        type="email"
        autoComplete="email"
        placeholder="Enter your email address"
      />
    </div>
  );
}
