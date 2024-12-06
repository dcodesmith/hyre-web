import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod";
import { ActionFunctionArgs, json, LoaderFunctionArgs } from "@remix-run/node";
import {
  Form,
  Outlet,
  // useActionData,
  useLoaderData,
  useNavigate,
} from "@remix-run/react";
// import { AuthorizationError } from "remix-auth";
import { CogIcon } from "@heroicons/react/24/outline";
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
import { useIsPending } from "~/lib/utils";
import { authenticator } from "~/modules/auth/auth.server";
import { commitSession, getSession } from "~/modules/auth/session.server";

export const LoginSchema = z.object({
  email: z
    .string({
      required_error: "Email is required.",
    })
    .max(60)
    .email("Email address is not valid."),
});

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticator.isAuthenticated(request, {
    successRedirect: "/",
    // failureRedirect: "/login",
  });
  console.log("login loader end");

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
  const url = new URL(request.url);
  const pathname = url.pathname;
  const redirectTo = url.searchParams.get("redirectTo");
  // const formData = await request.clone().formData();

  // const email = String(formData.get("email")) ?? "";

  // if (!email) {
  //   return { errors: { email: "Email is required" } };
  // }

  // try {
  return await authenticator.authenticate("TOTP", request, {
    successRedirect: redirectTo
      ? `/verify?redirectTo=${redirectTo}`
      : "/verify",
    failureRedirect: pathname,
  });
  // } catch (error) {
  // if (error instanceof CSRFError)
  //   return json(
  //     { error: "error with authenticating, please refresh" },
  //     { status: 403 }
  //   );
  // if (error instanceof AuthorizationError) {
  //   console.log("error AuthorizationError", error);

  //   return json({ error: error.message }, { status: 401 });
  // }

  // if (error instanceof Response) {
  //   console.log("error here", error);
  //   // @!@ FLOWS HERE @!@
  //   return error;

  //   // return null;
  // }
  // }
  // return redirect("/auth/verify");
}

export default function Login() {
  // const actionResult = useActionData<typeof action>();
  const { authEmail, authError } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const isPending = useIsPending();

  const [emailForm, { email }] = useForm({
    constraint: getZodConstraint(LoginSchema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: LoginSchema });
    },
  });

  return (
    <>
      <Dialog
        // open
        defaultOpen
        onOpenChange={(open: boolean) => {
          open ? () => {} : navigate(-1);
        }}
      >
        {/* <DialogTrigger asChild>
        <Button variant="outline" className="rounded-full h-10 w-10 px-0">
          <UserIcon className="h-5 w-5" />
        </Button>
      </DialogTrigger> */}
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Sign In</DialogTitle>
            <DialogDescription>
              Please enter your email to continue
            </DialogDescription>
          </DialogHeader>

          <Form method="post" {...getFormProps(emailForm)}>
            <div className="mt-4 flex flex-col sm:flex-col gap-4">
              <div className="space-y-1">
                <Input
                  defaultValue={authEmail ? authEmail : ""}
                  className={`bg-transparent ${
                    email.errors
                      ? "border-destructive focus-visible:ring-destructive"
                      : ""
                  }`}
                  {...getInputProps(email, { type: "email" })}
                  placeholder="Email"
                />
              </div>

              <div className="flex flex-col">
                {!authError && email.errors && (
                  <span className="mb-2 text-sm text-destructive dark:text-destructive-foreground">
                    {email.errors.join(" ")}
                  </span>
                )}
                {!authEmail && authError && (
                  <span className="mb-2 text-sm text-destructive dark:text-destructive-foreground">
                    {authError.message}
                  </span>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? (
                  <CogIcon className="h-5 w-5 animate-spin" />
                ) : (
                  "Continue with Email"
                )}
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
