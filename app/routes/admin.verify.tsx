import { Form, json, useActionData, useLoaderData } from "@remix-run/react";
import { ActionFunctionArgs, LoaderFunctionArgs, redirect } from "@remix-run/node";
import { authenticator } from "~/modules/auth/auth.server";
import { AuthorizationError } from "remix-auth";
import { commitSession, getSession } from "~/modules/auth/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  // Redirect to admin if already authenticated as admin
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
  try {
    return authenticator.authenticate("TOTP", request, {
      successRedirect: "/admin",
      failureRedirect: "/admin/verify",
      context: { role: "admin" },
    });
  } catch (error) {
    console.log("Error verifying admin", error);
    if (error instanceof AuthorizationError) {
      return json({ error: error.message }, { status: 401 });
    }

    if (error instanceof Response) {
      // @!@ FLOWS HERE @!@
      return error;

      // return null;
    }

    console.log("Error verifying admin", error);

    return json({ error: "Invalid verification code" }, { status: 400 });
  }
}

export default function AdminVerify() {
  // const actionData = useActionData<typeof action>();
  const { authEmail, authError } = useLoaderData<typeof loader>();

  console.log({ authEmail, authError });

  return (
    <div className="max-w-md mx-auto mt-8">
      <h1 className="text-2xl font-bold mb-4">Enter Verification Code</h1>
      <Form method="post">
        <div>
          <label htmlFor="code" className="block mb-2">
            Verification Code
          </label>
          <input
            type="text"
            name="code"
            id="code"
            className="w-full p-2 border rounded"
            required
            autoComplete="one-time-code"
          />
        </div>
        <button type="submit" className="mt-4 w-full bg-blue-500 text-white p-2 rounded">
          Verify
        </button>

        {authEmail && authError && (
          <span className="mb-2 text-sm text-destructive dark:text-destructive-foreground">
            {authError.message}
          </span>
        )}

        {/* {actionData?.error && <div className="text-red-500 text-sm">{actionData.error}</div>} */}
      </Form>
    </div>
  );
}
