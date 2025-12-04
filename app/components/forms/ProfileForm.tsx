import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import type { Role, User } from "@prisma/client";
import { useFetcher } from "@remix-run/react";
import { useEffect } from "react";
import { useAuthenticityToken } from "remix-utils/csrf/react";
import { profileFormSchema } from "~/schemas/user";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

interface ProfileFormContentProps {
  readonly user: (User & { roles: Pick<Role, "name">[] }) | null;
  readonly onCancel: () => void;
  readonly cancelLabel?: string;
  readonly submitLabel?: string;
  readonly buttonClassName?: string;
}

export function ProfileForm({
  user,
  onCancel,
  cancelLabel = "Cancel",
  submitLabel = "Save Changes",
  buttonClassName = "",
}: ProfileFormContentProps) {
  const fetcher = useFetcher<{ success: boolean; error?: string }>();
  const isSubmitting = fetcher.state === "submitting";
  const csrfToken = useAuthenticityToken();

  const [form, { name, email, phoneNumber, city, address }] = useForm({
    defaultValue: user,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: profileFormSchema });
    },
    shouldValidate: "onInput",
    shouldRevalidate: "onInput",
  });

  // Close modal on successful submission
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success) {
      onCancel();
    }
  }, [fetcher.state, fetcher.data, onCancel]);

  return (
    <fetcher.Form action="/profile" method="post" {...getFormProps(form)} className="space-y-4">
      {fetcher.data?.error && <p className="text-sm text-red-500">{fetcher.data.error}</p>}

      <input type="hidden" name="csrf" value={csrfToken} />

      <div className="space-y-1">
        <Label htmlFor={name.id}>Name</Label>
        <Input {...getInputProps(name, { type: "text" })} />
        {name.errors && <p className="text-sm text-destructive">{name.errors.join(" ")}</p>}
      </div>

      <div className="space-y-1">
        <Label htmlFor={email.id}>Email</Label>
        <Input {...getInputProps(email, { type: "email" })} />
        {email.errors && <p className="text-sm text-destructive">{email.errors.join(" ")}</p>}
      </div>

      <div className="space-y-1">
        <Label htmlFor={phoneNumber.id}>Phone</Label>
        <Input {...getInputProps(phoneNumber, { type: "tel" })} placeholder="+1234567890" />
        {phoneNumber.errors && (
          <p className="text-sm text-destructive">{phoneNumber.errors.join(" ")}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor={city.id}>City</Label>
        <Input {...getInputProps(city, { type: "text" })} />
        {city.errors && <p className="text-sm text-destructive">{city.errors.join(" ")}</p>}
      </div>

      <div className="space-y-1">
        <Label htmlFor={address.id}>Address</Label>
        <Input {...getInputProps(address, { type: "text" })} />
        {address.errors && <p className="text-sm text-destructive">{address.errors.join(" ")}</p>}
      </div>

      <input type="hidden" name="intent" value="update" />

      <div className="flex flex-col sm:flex-row gap-2 pt-4 sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className={`w-full sm:w-auto ${buttonClassName}`}
        >
          {cancelLabel}
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className={`w-full sm:w-auto ${buttonClassName}`}
        >
          {isSubmitting ? "Saving..." : submitLabel}
        </Button>
      </div>
    </fetcher.Form>
  );
}
