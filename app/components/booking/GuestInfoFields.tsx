import { type FieldMetadata, getInputProps } from "@conform-to/react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

const ERROR_RING_CLASSES = "border-red-500 focus-visible:ring-red-500 focus-visible:ring-2";

function FieldError({ errors }: { readonly errors?: readonly string[] }) {
  if (!errors || errors.length === 0) {
    return null;
  }
  return <p className="text-red-500 text-sm mt-1">{errors.join(", ")}</p>;
}

interface GuestInfoFieldsProps {
  nameField: FieldMetadata<string>;
  emailField: FieldMetadata<string>;
  phoneNumberField: FieldMetadata<string>;
}

export function GuestInfoFields({ nameField, emailField, phoneNumberField }: GuestInfoFieldsProps) {
  const nameProps = getInputProps(nameField, { type: "text", ariaAttributes: true });
  const emailProps = getInputProps(emailField, { type: "email", ariaAttributes: true });
  const phoneProps = getInputProps(phoneNumberField, { type: "tel", ariaAttributes: true });

  return (
    <>
      <div className="space-y-1">
        <Label htmlFor={nameField.id}>Name</Label>
        <Input
          {...nameProps}
          placeholder="Enter your full name"
          className={`w-full rounded ${nameField.errors ? ERROR_RING_CLASSES : ""}`}
        />
        <FieldError errors={nameField.errors} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={emailField.id}>Email</Label>
        <Input
          {...emailProps}
          placeholder="Enter your email"
          className={`w-full rounded ${emailField.errors ? ERROR_RING_CLASSES : ""}`}
        />
        <FieldError errors={emailField.errors} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={phoneNumberField.id}>Phone Number</Label>
        <Input
          {...phoneProps}
          placeholder="Enter your phone number"
          className={`w-full rounded ${phoneNumberField.errors ? ERROR_RING_CLASSES : ""}`}
        />
        <FieldError errors={phoneNumberField.errors} />
      </div>
    </>
  );
}
