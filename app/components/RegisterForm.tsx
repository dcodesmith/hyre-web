import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod";
import { useFetcher } from "@remix-run/react";
import { z } from "zod";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";

const roles = ["user", "fleetOwner"] as const;

export const VerifyLoginSchema = z.object({
  code: z
    .string({
      required_error: "Code is required.",
    })
    .min(6, "Code must be at least 6 characters."),
  intent: z.enum(["register", "verify"]),
});

const RegisterSchema = z.object({
  email: z.string().email("Invalid email address"),
  phoneNumber: z.string().min(10, "Phone number must be at least 10 digits"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  role: z.enum(roles, {
    required_error: "You need to select a user type.",
  }),
  intent: z.enum(["register", "verify"]),
});

const errorRingClasses = "border-red-500 focus-visible:ring-red-500 focus-visible:ring-2";

type RegisterFormProps = {
  onOpenChange: (open: boolean) => void;
};

const userTypeOptions = {
  user: { label: "Client", description: "Book a chauffeur-driven car" },
  fleetOwner: {
    label: "Fleet Owner",
    description: "List and manage your fleet",
  },
};

export function RegisterForm({ onOpenChange }: RegisterFormProps) {
  const registerFetcher = useFetcher<{ success: boolean; error?: string }>({
    key: "register",
  });
  const verifyFetcher = useFetcher<{ success: boolean; error?: string }>({
    key: "verify",
  });
  const isSubmitting = registerFetcher.state === "submitting";

  const [codeForm, { code }] = useForm({
    // constraint: getZodConstraint(VerifyLoginSchema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: VerifyLoginSchema });
    },
  });

  const [registerForm, { email, phoneNumber, name, role }] = useForm({
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
          <DialogDescription>Create an account to get started.</DialogDescription>
        </DialogHeader>

        {registerFetcher.state === "idle" && registerFetcher.data?.success ? (
          <verifyFetcher.Form action="/verification" method="post" {...getFormProps(codeForm)}>
            <input type="hidden" name="intent" value="verify" />
            <div className="mt-4 flex flex-col sm:flex-col gap-4">
              <div className="space-y-1">
                <Input
                  placeholder="Code"
                  required
                  className={`bg-transparent ${
                    code.errors && "border-destructive focus-visible:ring-destructive"
                  }`}
                  {...getInputProps(code, { type: "text" })}
                />
              </div>

              {/* <div className="flex flex-col">
                {!authError && code.errors && (
                  <span className="mb-2 text-sm text-destructive dark:text-destructive-foreground">
                    {code.errors.join(" ")}
                  </span>
                )}
                {authEmail && authError && (
                  <span className="mb-2 text-sm text-destructive dark:text-destructive-foreground">
                    {authError.message}
                  </span>
                )}
              </div> */}

              <Button type="submit" className="w-full">
                Continue
              </Button>
            </div>
          </verifyFetcher.Form>
        ) : (
          <registerFetcher.Form
            method="post"
            action="/registration"
            className="space-y-4"
            {...getFormProps(registerForm)}
          >
            <input type="hidden" name="intent" value="register" />

            <div className="space-y-1">
              <RadioGroup
                onValueChange={(value) => {
                  registerForm.update({
                    [role.name]: value,
                  });
                }}
                className="grid grid-cols-2"
                name={role.name}
              >
                {roles.map((_role) => (
                  <div key={_role}>
                    <RadioGroupItem
                      value={_role}
                      id={_role}
                      className="peer sr-only"
                      aria-label={userTypeOptions[_role].label}
                    />
                    <Label
                      htmlFor={_role}
                      className={`flex flex-col items-center justify-between rounded-md border p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary ${
                        role.errors ? errorRingClasses : ""
                      }`}
                    >
                      <span className="text-sm font-medium">{userTypeOptions[_role].label}</span>
                      <span className="text-xs text-muted-foreground">
                        {userTypeOptions[_role].description}
                      </span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>

              {role.errors && (
                <div className="text-destructive text-sm">{role.errors.join(", ")}</div>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor={name.id}>Full Name</Label>
              <Input
                {...getInputProps(name, { type: "text" })}
                placeholder="John Doe"
                className={name.errors ? errorRingClasses : ""}
              />
              {name.errors && (
                <div className="text-destructive text-sm">{name.errors.join(", ")}</div>
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
                <div className="text-destructive text-sm">{email.errors.join(", ")}</div>
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
                <div className="text-destructive text-sm">{phoneNumber.errors.join(", ")}</div>
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
          </registerFetcher.Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
