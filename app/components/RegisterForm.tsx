import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod";
import { z } from "zod";
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
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";

const RegisterSchema = z.object({
  email: z.string().email("Invalid email address"),
  phoneNumber: z.string().min(10, "Phone number must be at least 10 digits"),
  name: z.string().min(2, "Name must be at least 2 characters"),
});

const errorRingClasses =
  "border-red-500 focus-visible:ring-red-500 focus-visible:ring-2";

type RegisterFormProps = {
  onOpenChange: (open: boolean) => void;
};

export function RegisterForm({ onOpenChange }: RegisterFormProps) {
  const fetcher = useFetcher<{ success: boolean; error?: string }>();
  const isSubmitting = fetcher.state === "submitting";

  const [form, { email, phoneNumber, name }] = useForm({
    id: "register",
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: RegisterSchema });
    },
    shouldValidate: "onInput",
    shouldRevalidate: "onInput",
  });

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create an account</DialogTitle>
          <DialogDescription>
            Create an account to get started.
          </DialogDescription>
        </DialogHeader>

        <fetcher.Form
          method="post"
          className="space-y-4"
          {...getFormProps(form)}
        >
          <RadioGroup className="grid grid-cols-2" defaultValue="client">
            <div>
              <RadioGroupItem
                value="client"
                id="client"
                className="peer sr-only"
                aria-label="Client"
              />
              <Label
                htmlFor="client"
                className="flex flex-col items-center justify-between rounded-md border p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
              >
                <span className="text-sm font-medium">Client</span>
                <span className="text-xs text-muted-foreground">
                  Book a chauffeur-driven car
                </span>
              </Label>
            </div>

            <div>
              <RadioGroupItem
                value="fleet-owner"
                id="fleet-owner"
                className="peer sr-only"
                aria-label="Fleet Owner"
              />
              <Label
                htmlFor="fleet-owner"
                className="flex flex-col items-center justify-between rounded-md border p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
              >
                <span className="text-sm font-medium">Fleet Owner</span>
                <span className="text-xs text-muted-foreground">
                  List and manage your fleet
                </span>
              </Label>
            </div>
          </RadioGroup>

          <div className="space-y-1">
            <Label htmlFor={name.id}>Full Name</Label>
            <Input
              {...getInputProps(name, { type: "text" })}
              placeholder="John Doe"
              className={name.errors ? errorRingClasses : ""}
            />
            {name.errors && (
              <div className="text-destructive text-sm">
                {name.errors.join(", ")}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor={email.id}>Email</Label>
            <Input
              {...getInputProps(email, { type: "email" })}
              placeholder="email@example.com"
              className={email.errors ? errorRingClasses : ""}
            />
            {email.errors && (
              <div className="text-destructive text-sm">
                {email.errors.join(", ")}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor={phoneNumber.id}>Phone Number</Label>
            <Input
              {...getInputProps(phoneNumber, { type: "tel" })}
              placeholder="+1234567890"
              className={phoneNumber.errors ? errorRingClasses : ""}
            />
            {phoneNumber.errors && (
              <div className="text-destructive text-sm">
                {phoneNumber.errors.join(", ")}
              </div>
            )}
          </div>

          <DialogFooter className="sm:gap-0 gap-4">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Register"}
            </Button>
          </DialogFooter>
        </fetcher.Form>
      </DialogContent>
    </Dialog>
  );
}
