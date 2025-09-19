import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod";
import { CogIcon } from "@heroicons/react/24/outline";
import { ActionFunctionArgs, LoaderFunctionArgs, data } from "@remix-run/node";
import {
  Outlet,
  useActionData,
  useLoaderData,
  useNavigate,
  useSearchParams,
} from "@remix-run/react";

import { AuthorizationError } from "remix-auth";
import { z } from "zod";
import { Form } from "~/components/CSRFForm";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { useIsPending } from "~/lib/utils";
import { authenticator } from "~/modules/auth/auth.server";
import { getSession } from "~/modules/auth/session.server";
import { validateCSRF } from "~/utils/csrf-action.server";
import { safeRedirect } from "~/utils/safe-redirect";

const roles = ["user", "fleetOwner"] as const;

export const LoginSchema = z.object({
  email: z
    .string({
      required_error: "Email is required.",
    })
    .trim()
    .max(60)
    .email("Email address is not valid."),
  role: z
    .enum(roles, {
      required_error: "You need to select a user type.",
    })
    .default("user"),
});

export async function loader({ request }: LoaderFunctionArgs) {
  // const user = await authenticator.isAuthenticated(request);

  // if (user) {
  //   return redirect("/");
  // }

  await authenticator.isAuthenticated(request, {
    successRedirect: "/",
  });

  const cookie = await getSession(request.headers.get("Cookie"));
  const authEmail = cookie.get("auth:email");
  const authError = cookie.get(authenticator.sessionErrorKey);

  return { authEmail, authError };
}

export async function action({ request }: ActionFunctionArgs) {
  await validateCSRF(request);

  const formData = await request.clone().formData();
  // const role = (formData.get("role") as string | null) ?? "user"; // Default to least privileged role

  // Validate the form data
  const submission = parseWithZod(formData, { schema: LoginSchema });
  if (submission.status !== "success") {
    return data(submission.reply(), { status: 400 });
  }

  const url = new URL(request.url);
  const pathname = url.pathname;
  const redirectTo = safeRedirect(url.searchParams.get("redirectTo"), "");

  const { role } = submission.value;

  try {
    // Build the verify URL with appropriate parameters
    const verifyParams = new URLSearchParams();
    if (redirectTo) {
      verifyParams.set("redirectTo", redirectTo);
    }
    verifyParams.set("role", role);

    const response = await authenticator.authenticate("TOTP", request, {
      successRedirect: `/verify?${verifyParams.toString()}`,
      failureRedirect: pathname,
      context: { intent: "login", role },
    });
    return response;
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return data({ error: error.message }, { status: 401 });
    }

    if (error instanceof Response) {
      return error;
    }

    throw error;
  }
}

export default function Login() {
  const { authEmail, authError } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isPending = useIsPending();

  const redirectToUrl = safeRedirect(searchParams.get("redirectTo"), "");

  const roleFromRedirect = redirectToUrl
    ? new URL(redirectToUrl, "https://dummy.com").searchParams.get("role")
    : null;

  const defaultRole = roleFromRedirect || searchParams.get("role") || "user";

  const [form, { email, role }] = useForm({
    defaultValue: {
      role: defaultRole,
    },
    constraint: getZodConstraint(LoginSchema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: LoginSchema });
    },
    shouldValidate: "onSubmit",
    shouldRevalidate: "onInput",
  });

  return (
    <>
      <Dialog
        defaultOpen
        onOpenChange={(open: boolean) => {
          if (!open) navigate(-1);
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Register or Sign In</DialogTitle>
            <DialogDescription>Enter your email to continue</DialogDescription>
          </DialogHeader>

          <Form method="post" {...getFormProps(form)}>
            <div className="mt-2 flex flex-col sm:flex-col gap-4">
              {/* <div className="space-y-1">
                <RadioGroup
                  value={role.value}
                  onValueChange={(value) => {
                    form.update({
                      value: {
                        role: value,
                      },
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
              </div> */}

              <input type="hidden" name="role" value={role.value} />

              <div className="space-y-1">
                <Input
                  defaultValue={authEmail ?? ""}
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

              {!authEmail && actionData?.error && (
                <span className="mb-2 text-sm text-destructive dark:text-destructive-foreground">
                  {actionData.error}
                </span>
              )}

              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? <CogIcon className="h-5 w-5 animate-spin" /> : "Continue with Email"}
              </Button>
            </div>

            {authError && (
              <div className="text-red-500 text-sm text-center">
                {typeof authError === "string" ? authError : authError?.message}
              </div>
            )}
          </Form>
        </DialogContent>
      </Dialog>
      <Outlet />
    </>
  );
}
