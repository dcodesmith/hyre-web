import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod";
import { User } from "@prisma/client";
import { ActionFunctionArgs, LoaderFunctionArgs, json, redirect } from "@remix-run/node";
import { Form, useLoaderData, useNavigate, useSearchParams } from "@remix-run/react";
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
import { userHasRole } from "~/utils/misc";

export const VerifySchema = z.object({
  code: z
    .string({
      required_error: "Code is required.",
    })
    .min(6, "Code must be at least 6 characters."),
});

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const redirectTo = url.searchParams.get("redirectTo");

  await authenticator.isAuthenticated(request, {
    successRedirect: redirectTo ? `/?redirectTo=${redirectTo}` : "/",
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
  const url = new URL(request.url);
  const currentPath = url.pathname;
  // const redirectTo = url.searchParams.get("redirectTo");
  const role = url.searchParams.get("role");

  let user: User | null = null;

  try {
    const successRedirect = role === "fleetOwner" ? "/fleet-owner" : "/";

    user = await authenticator.authenticate("TOTP", request, {
      successRedirect,
      failureRedirect: currentPath,
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      console.log("error AuthorizationError", error);

      return json({ error: error.message }, { status: 401 });
    }

    if (error instanceof Response) {
      // @!@ FLOWS HERE @!@
      return error;

      // return null;
    }
  }

  if (userHasRole(user, "fleetOwner")) {
    return redirect("/fleet-owner");
  }

  return redirect("/");
}

export default function Verify() {
  const { authEmail, authError } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();

  const redirectTo = searchParams.get("redirectTo");
  console.log(redirectTo);
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
