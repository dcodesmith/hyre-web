import { type FieldMetadata, getInputProps } from "@conform-to/react";
import { cn } from "cn";
import { type ChangeEvent, useRef, useState } from "react";

import {
  bookingPhoneInputClassName,
  phoneValidationMessage,
} from "~/booking/booking-phone-verification";
import { FormError } from "~/components/forms/form-primitives";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";

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
        className={cn(bookingPhoneInputClassName, field.errors && "border-red-500")}
      />
      <FormError id={field.errorId} errors={field.errors} />
    </div>
  );
}

function GuestPhoneField({ field }: { readonly field: FieldMetadata<string> }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [formatError, setFormatError] = useState<string | null>(null);
  const inputProps = getInputProps(field, { type: "tel" });
  const invalid = Boolean(field.errors?.length) || formatError != null;

  return (
    <div className="space-y-1">
      <Label htmlFor={field.id} className="block font-semibold leading-5">
        Phone Number
      </Label>
      <p className="text-sm leading-5 text-gray-700">We’ll send you a code to verify this number</p>
      <div className="flex items-center gap-2">
        <input
          {...inputProps}
          ref={inputRef}
          autoComplete="tel"
          spellCheck={false}
          placeholder="+234 803 123 4675"
          aria-invalid={invalid ? true : undefined}
          className={cn(bookingPhoneInputClassName, invalid && "border-red-500")}
          onChange={(event) => {
            const notify = (
              inputProps as { onChange?: (event: ChangeEvent<HTMLInputElement>) => void }
            ).onChange;
            notify?.(event);
            if (formatError) {
              setFormatError(phoneValidationMessage(event.target.value));
            }
          }}
        />
        <Button
          type="button"
          className="h-10 shrink-0 rounded-md px-4"
          onClick={() => setFormatError(phoneValidationMessage(inputRef.current?.value ?? ""))}
        >
          Send code
        </Button>
      </div>
      <FormError id={field.errorId} errors={formatError ? [formatError] : field.errors} />
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
      <GuestPhoneField field={fields.phoneNumber} />
    </div>
  );
}
