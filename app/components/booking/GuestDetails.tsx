import { type FieldMetadata, getInputProps } from "@conform-to/react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

function FieldError({ errors }: { readonly errors?: readonly string[] }) {
  if (!errors || errors.length === 0) {
    return null;
  }
  return <p className="text-red-500 text-sm mt-1">{errors.join(", ")}</p>;
}

interface GuestDetailsProps {
  readonly fields: {
    name: FieldMetadata<string>;
    email: FieldMetadata<string>;
    phoneNumber: FieldMetadata<string>;
  };
  readonly errorRingClasses: string;
}

export function GuestDetails({ fields, errorRingClasses }: GuestDetailsProps) {
  return (
    <div className="bg-white border border-neutral-200 lg:border-none rounded shadow-xl inset-shadow-sm transform-gpu px-4 py-4 lg:bg-transparent lg:shadow-none lg:rounded-none lg:px-0 lg:py-0">
      <div className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor={fields.name.id} className="font-semibold">
            Name
          </Label>
          <Input
            {...getInputProps(fields.name, { type: "text", ariaAttributes: true })}
            placeholder="Enter your full name"
            className={fields.name.errors ? errorRingClasses : ""}
          />
          <FieldError errors={fields.name.errors} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={fields.email.id} className="font-semibold">
            Email
          </Label>
          <Input
            {...getInputProps(fields.email, { type: "email", ariaAttributes: true })}
            placeholder="Enter your email"
            className={fields.email.errors ? errorRingClasses : ""}
          />
          <FieldError errors={fields.email.errors} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={fields.phoneNumber.id} className="font-semibold">
            Phone Number
          </Label>
          <Input
            {...getInputProps(fields.phoneNumber, { type: "tel", ariaAttributes: true })}
            placeholder="Enter your phone number"
            className={fields.phoneNumber.errors ? errorRingClasses : ""}
          />
          <FieldError errors={fields.phoneNumber.errors} />
        </div>
      </div>
    </div>
  );
}
