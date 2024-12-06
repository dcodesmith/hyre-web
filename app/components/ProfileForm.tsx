import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod";
import { Role, User } from "@prisma/client";
import { useFetcher } from "@remix-run/react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { profileFormSchema } from "~/schemas/user";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { useEffect } from "react";

interface ProfileFormProps {
  onOpenChange: (open: boolean) => void;
  user: (User & { roles: Pick<Role, "name">[] }) | null;
}

export function ProfileForm({ onOpenChange, user }: ProfileFormProps) {
  const fetcher = useFetcher<{ success: boolean; error?: string }>();
  const isSubmitting = fetcher.state === "submitting";

  const [form, { name, email, phoneNumber, city, address }] = useForm({
    defaultValue: user,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: profileFormSchema });
    },
    shouldValidate: "onInput",
    shouldRevalidate: "onInput",
  });

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success) {
      onOpenChange(false);
    }
  }, [fetcher.state, fetcher.data, onOpenChange]);

  return (
    <Dialog defaultOpen={true} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>
            Make changes to your profile here.
          </DialogDescription>
        </DialogHeader>

        <fetcher.Form
          action="/profile"
          method="put"
          {...getFormProps(form)}
          className="space-y-4"
        >
          {fetcher.data?.error && (
            <p className="text-sm text-red-500">{fetcher.data.error}</p>
          )}

          <div className="space-y-1">
            <Label htmlFor={name.id}>Name</Label>
            <Input {...getInputProps(name, { type: "text" })} />
            {name.errors && (
              <p className="text-sm text-destructive">
                {name.errors.join(" ")}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor={email.id}>Email</Label>
            <Input {...getInputProps(email, { type: "email" })} />
          </div>

          <div className="space-y-1">
            <Label htmlFor={phoneNumber.id}>Phone</Label>
            <Input
              {...getInputProps(phoneNumber, { type: "tel" })}
              className={
                phoneNumber.errors
                  ? "border-red-500 focus-visible:ring-red-500 focus-visible:ring-2"
                  : ""
              }
            />
            {phoneNumber.errors && (
              <p className="text-sm text-destructive">
                {phoneNumber.errors.join(" ")}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor={address.id}>Address</Label>
            <Input {...getInputProps(address, { type: "text" })} />
          </div>

          <div className="space-y-1">
            <Label htmlFor={city.id}>City</Label>
            <Input {...getInputProps(city, { type: "text" })} />
          </div>

          <input type="hidden" name="intent" value="update" />

          <DialogFooter className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Close
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </fetcher.Form>
      </DialogContent>
    </Dialog>
  );
}
