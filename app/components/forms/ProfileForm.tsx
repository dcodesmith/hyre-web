import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import type { Role, User } from "@prisma/client";
import { useFetcher, useNavigate } from "@remix-run/react";
import { useEffect } from "react";
import { useAuthenticityToken } from "remix-utils/csrf/react";
import { profileFormSchema } from "~/schemas/user";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";
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
  const deleteFetcher = useFetcher<{ success: boolean; error?: string }>();
  const navigate = useNavigate();
  const isSubmitting = fetcher.state === "submitting";
  const isDeleting = deleteFetcher.state !== "idle";
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

  // Redirect to auth page after successful account deletion
  useEffect(() => {
    if (deleteFetcher.state === "idle" && deleteFetcher.data?.success) {
      navigate("/auth");
    }
  }, [deleteFetcher.state, deleteFetcher.data, navigate]);

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

      {/* Delete Account Section */}
      <div className="border-t border-red-200 pt-4 mt-6">
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-red-600">Danger Zone</h3>
          <p className="text-sm text-gray-600">
            Once you delete your account, there is no going back. Your personal data will be
            permanently removed.
          </p>

          {deleteFetcher.data?.error && (
            <p className="text-sm text-red-500">{deleteFetcher.data.error}</p>
          )}

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="destructive"
                className="w-full sm:w-auto"
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete Account"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete your account, including
                  your profile, bank details, and identity documents. Your booking history will be
                  anonymized for our records.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    const formData = new FormData();
                    formData.append("csrf", csrfToken);
                    deleteFetcher.submit(formData, {
                      method: "POST",
                      action: "/api/account/delete",
                    });
                  }}
                  className="bg-red-500 hover:bg-red-600 disabled:opacity-50"
                  disabled={isDeleting}
                >
                  {isDeleting ? "Deleting..." : "Delete Account"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </fetcher.Form>
  );
}
