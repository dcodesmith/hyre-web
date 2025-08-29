import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod";
import { User } from "@prisma/client";
import { ActionFunctionArgs, LoaderFunctionArgs, json, redirect } from "@remix-run/node";
import { useLoaderData, useNavigate, useSearchParams } from "@remix-run/react";
import { Form } from "~/components/CSRFForm";
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
import { authenticator } from "~/modules/auth/auth.server";
import { commitSession, getSession } from "~/modules/auth/session.server";
import { userHasRole } from "~/utils/client/misc";
import { validateCSRF } from "~/utils/csrf-action.server";
import { safeRedirect } from "~/utils/safe-redirect";

export const VerifySchema = z.object({
  code: z
    .string({
      required_error: "Code is required.",
    })
    .min(6, "Code must be at least 6 characters."),
});

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const redirectTo = safeRedirect(url.searchParams.get("redirectTo"), "");

  await authenticator.isAuthenticated(request, {
    successRedirect: redirectTo ? `/?redirectTo=${encodeURIComponent(redirectTo)}` : "/",
  });

  const cookie = await getSession(request.headers.get("Cookie"));
  const authEmail = cookie.get("auth:email");
  const authError = cookie.get(authenticator.sessionErrorKey);

  if (!authEmail) return redirect("/auth");

  return json({ authEmail, authError } as const, {
    headers: {
      "Set-Cookie": await commitSession(cookie),
    },
  });
}

export async function action({ request }: ActionFunctionArgs) {
  await validateCSRF(request);

  const url = new URL(request.url);
  const currentPath = url.pathname;
  const redirectTo = safeRedirect(url.searchParams.get("redirectTo"), "");
  let role = url.searchParams.get("role");

  // If redirectTo contains a role parameter, use that, otherwise keep the role from URL params
  if (redirectTo) {
    const roleFromRedirectTo = new URL(redirectTo, "https://dummy.com").searchParams.get("role");
    if (roleFromRedirectTo) {
      role = roleFromRedirectTo;
    }
  }

  let user: User | null = null;

  try {
    const successRedirect = role === "fleetOwner" ? "/fleet-owner" : redirectTo ? redirectTo : "/";

    user = await authenticator.authenticate("TOTP", request, {
      successRedirect,
      failureRedirect: currentPath,
    });

    // If authentication is successful and the user is a fleet owner, check onboarding status
    // const user = await authenticator.isAuthenticated(request);
    // if (user && role === "fleetOwner") {
    //   const fleetOwner = await prisma.user.findUnique({
    //     where: { id: user.id },
    //     select: { hasOnboarded: true },
    //   });

    //   if (fleetOwner && !fleetOwner.hasOnboarded) {
    //     return redirect("/fleet-owner/onboarding");
    //   }
    // }
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return json({ error: error.message }, { status: 401 });
    }

    if (error instanceof Response) {
      return error;
    }
  }

  if (user && userHasRole(user, "fleetOwner")) {
    return redirect("/fleet-owner");
  }

  return redirect("/");
}

export default function Verify() {
  const { authEmail, authError } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();

  const redirectTo = searchParams.get("redirectTo");
  // const actionData = useActionData<typeof action>();
  const navigate = useNavigate();

  const [codeForm, { code }] = useForm({
    constraint: getZodConstraint(VerifySchema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: VerifySchema });
    },
  });

  return (
    <Dialog
      defaultOpen
      onOpenChange={(open: boolean) => {
        open ? () => {} : navigate(-1);
      }}
    >
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Verify</DialogTitle>
          <DialogDescription>
            We&apos;ve emailed you a code, please enter it below.
          </DialogDescription>
        </DialogHeader>
        <Form method="post" {...getFormProps(codeForm)}>
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
              {/* {actionData?.errors.code && (
                <p className="text-red-500 text-sm text-muted-foreground">
                  {actionData.errors.code}
                </p>
              )} */}
            </div>

            <div className="flex flex-col">
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
            </div>

            <Button type="submit" className="w-full">
              Continue
            </Button>
          </div>
        </Form>

        {/* className="flex w-full flex-col" */}
        <Form method="POST">
          {/* <AuthenticityTokenInput />
          <HoneypotInputs /> */}

          <p className="text-center text-sm font-normal text-primary/60">
            Did not receive the code?
          </p>
          <Button type="submit" variant="ghost" className="w-full hover:bg-transparent">
            Request New Code
          </Button>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
