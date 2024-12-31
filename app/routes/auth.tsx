import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod";
import { CogIcon } from "@heroicons/react/24/outline";
import { ActionFunctionArgs, LoaderFunctionArgs, json } from "@remix-run/node";
import {
  Form,
  Outlet,
  // useActionData,
  useLoaderData,
  useNavigate,
} from "@remix-run/react";
import { AuthorizationError } from "remix-auth";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { useIsPending } from "~/lib/utils";
import { authenticator } from "~/modules/auth/auth.server";
import { commitSession, getSession } from "~/modules/auth/session.server";

const roles = ["user", "fleetOwner"] as const;

export const LoginSchema = z.object({
  email: z
    .string({
      required_error: "Email is required.",
    })
    .max(60)
    .email("Email address is not valid."),
  role: z.enum(roles, {
    required_error: "You need to select a user type.",
  }),
});

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticator.isAuthenticated(request, {
    successRedirect: "/",
    // failureRedirect: "/login",
  });

  const cookie = await getSession(request.headers.get("Cookie"));
  const authEmail = cookie.get("auth:email");
  const authError = cookie.get(authenticator.sessionErrorKey);

  return json({ authEmail, authError } as const, {
    headers: {
      "Set-Cookie": await commitSession(cookie),
    },
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.clone().formData();
  const role = String(formData.get("role"));
  const url = new URL(request.url);
  const pathname = url.pathname;
  const redirectTo = url.searchParams.get("redirectTo");

  try {
    return await authenticator.authenticate("TOTP", request, {
      successRedirect: redirectTo ? `/verify?redirectTo=${redirectTo}` : `/verify?role=${role}`,
      failureRedirect: pathname,
      context: { intent: "login", role },
    });
  } catch (error) {
    // if (error instanceof CSRFError) {
    //   return json(
    //     { error: "error with authenticating, please refresh" },
    //     { status: 403 }
    //   );
    // }
    if (error instanceof AuthorizationError) {
      return json({ error: error.message }, { status: 401 });
    }

    if (error instanceof Response) {
      // @!@ FLOWS HERE @!@
      return error;

      // return null;
    }
  }
}

const errorRingClasses = "border-red-500 focus-visible:ring-red-500 focus-visible:ring-2";

const userTypeOptions = {
  user: { label: "Client", description: "Book a chauffeur-driven car" },
  fleetOwner: {
    label: "Fleet Owner",
    description: "List and manage your fleet",
  },
};

export default function Login() {
  // const actionResult = useActionData<typeof action>();
  const { authEmail, authError } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const isPending = useIsPending();

  const [form, { email, role }] = useForm({
    constraint: getZodConstraint(LoginSchema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: LoginSchema });
    },
    shouldValidate: "onInput",
    shouldRevalidate: "onInput",
  });

  return (
    <>
      <Dialog
        defaultOpen
        onOpenChange={(open: boolean) => {
          open ? () => {} : navigate(-1);
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Register or Sign In</DialogTitle>
            <DialogDescription>
              Please select a user type and enter your email to continue
            </DialogDescription>
          </DialogHeader>

          <Form method="post" {...getFormProps(form)}>
            <div className="mt-2 flex flex-col sm:flex-col gap-4">
              <div className="space-y-1">
                <RadioGroup
                  onValueChange={(value) => {
                    form.update({
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
                <Input
                  defaultValue={authEmail ? authEmail : ""}
                  className={`bg-transparent ${
                    email.errors ? "border-destructive focus-visible:ring-destructive" : ""
                  }`}
                  {...getInputProps(email, { type: "email" })}
                  placeholder="Email"
                />
                {email.errors && (
                  <div className="text-destructive text-sm">{email.errors.join(", ")}</div>
                )}
              </div>

              {!authEmail && authError && (
                <span className="mb-2 text-sm text-destructive dark:text-destructive-foreground">
                  {authError.message}
                </span>
              )}

              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? <CogIcon className="h-5 w-5 animate-spin" /> : "Continue with Email"}
              </Button>
            </div>

            {/* Email Errors Handling. */}
            {/* {!authEmail && (
            <span>
              auth email error: {authError?.message || "email?.error"}
            </span>
          )} */}
            {/* Code Errors Handling. */}
            {/* {authEmail && <span>{authError?.message || "code?.error"}</span>} */}
          </Form>
        </DialogContent>
      </Dialog>
      <Outlet />
    </>
  );
}
