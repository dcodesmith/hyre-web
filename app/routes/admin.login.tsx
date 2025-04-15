import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useSearchParams } from "@remix-run/react";
import { AuthorizationError } from "remix-auth";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import logger from "~/lib/logger.server";
import { authenticator } from "~/modules/auth/auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  // Redirect to admin if already authenticated as admin
  const user = await authenticator.isAuthenticated(request);
  if (user) {
    return redirect("/admin");
  }
  return null;
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.clone().formData();
  const email = formData.get("email");

  if (!email || typeof email !== "string") {
    return { error: "Email is required" };
  }

  try {
    logger.info(`Authenticating admin, email: ${email}`);
    return authenticator.authenticate("TOTP", request, {
      successRedirect: "/admin/verify?role=admin",
      failureRedirect: "/admin/login",
      context: { role: "admin" },
    });
  } catch (error) {
    logger.error(`Error authenticating admin, email: ${email}`, error);
    if (error instanceof AuthorizationError) {
      return json({ error: error.message }, { status: 401 });
    }

    if (error instanceof Response) {
      // @!@ FLOWS HERE @!@
      return error;

      // return null;
    }

    return json({ error: "Invalid email" }, { status: 400 });
  }
}

export default function AdminLogin() {
  const actionData = useActionData<typeof action>();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirectTo");

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md space-y-8 p-6">
        <div>
          <h2 className="text-center text-3xl font-bold">Admin Login</h2>
        </div>
        <Form method="post" className="space-y-6">
          <div>
            <Input name="email" type="email" required placeholder="Email" className="w-full" />
          </div>
          {actionData?.error && <div className="text-red-500 text-sm">{actionData.error}</div>}
          <input type="hidden" name="role" value="admin" />
          {redirectTo && <input type="hidden" name="redirectTo" value={redirectTo} />}
          <Button type="submit" className="w-full">
            Send verification code
          </Button>
        </Form>
      </div>
    </div>
  );
}
