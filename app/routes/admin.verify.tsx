import { useActionData, useLoaderData } from "@remix-run/react";
import { ActionFunctionArgs, LoaderFunctionArgs, redirect, json } from "@remix-run/node";
import { authenticator } from "~/modules/auth/auth.server";
import { AuthorizationError } from "remix-auth";
import { commitSession, getSession } from "~/modules/auth/session.server";
import { Button } from "~/components/ui/button";
import { safeRedirect } from "~/utils/safe-redirect";
import { validateCSRF } from "~/utils/csrf-action.server";
import { Form } from "~/components/CSRFForm";

export async function loader({ request }: LoaderFunctionArgs) {
  // Redirect to admin if already authenticated
  const url = new URL(request.url);
  const redirectTo = safeRedirect(url.searchParams.get("redirectTo"));

  await authenticator.isAuthenticated(request, {
    successRedirect: redirectTo || "/admin",
  });

  const cookie = await getSession(request.headers.get("Cookie"));
  const authEmail = cookie.get("auth:email");
  const authError = cookie.get(authenticator.sessionErrorKey);

  if (!authEmail) return redirect("/admin/login");

  return json({ authEmail, authError } as const, {
    headers: {
      "Set-Cookie": await commitSession(cookie),
    },
  });
}

export async function action({ request }: ActionFunctionArgs) {
  await validateCSRF(request);

  const url = new URL(request.url);
  const redirectTo = safeRedirect(url.searchParams.get("redirectTo"));
  const role = url.searchParams.get("role");

  try {
    return authenticator.authenticate("TOTP", request, {
      successRedirect: redirectTo || "/admin",
      failureRedirect: role ? `/admin/verify?role=${role}` : "/admin/verify",
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return json({ error: error.message }, { status: 401 });
    }

    if (error instanceof Response) {
      return error;
    }

    return json({ error: "Invalid verification code" }, { status: 400 });
  }
}

export default function AdminVerify() {
  const actionData = useActionData<typeof action>();
  const { authError } = useLoaderData<typeof loader>();

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md space-y-8 p-6">
        <div>
          <h2 className="text-center text-3xl font-bold">Enter Verification Code</h2>
          <p className="text-center text-gray-600 mt-2">
            Check your email for the verification code
          </p>
        </div>
        <Form method="post" className="space-y-6">
          <div>
            <label htmlFor="code" className="block text-sm font-medium mb-2">
              Verification Code
            </label>
            <input
              type="text"
              name="code"
              id="code"
              className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              autoComplete="one-time-code"
              placeholder="Enter 6-digit code"
            />
          </div>
          <Button type="submit" className="w-full">
            Verify
          </Button>

          {authError && (
            <div className="text-red-500 text-sm text-center">
              {typeof authError === "string" ? authError : authError?.message}
            </div>
          )}

          {actionData?.error && (
            <div className="text-red-500 text-sm text-center">{actionData.error}</div>
          )}
        </Form>
      </div>
    </div>
  );
}
