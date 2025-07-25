import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useSearchParams } from "@remix-run/react";
import { AuthorizationError } from "remix-auth";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import logger from "~/lib/logger.server";
import { authenticator } from "~/modules/auth/auth.server";
import { prisma } from "~/modules/db/db.server";

export async function loader({ request }: LoaderFunctionArgs) {
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
    // Check if the user exists and has the correct role
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        roles: {
          select: { name: true },
        },
      },
    });

    if (!user) {
      return json({ error: "Invalid email" }, { status: 401 });
    }

    const isAdmin = user.roles.some((role) => role.name === "admin");
    const isStaff = user.roles.some((role) => role.name === "staff");

    if (!isAdmin && !isStaff) {
      return json({ error: "Unauthorized access" }, { status: 403 });
    }

    logger.info(`Authenticating admin/staff, email: ${email}`);
    return authenticator.authenticate("TOTP", request, {
      successRedirect: `/admin/verify?role=${isAdmin ? "admin" : "staff"}`,
      failureRedirect: "/admin/login",
      context: { role: isAdmin ? "admin" : "staff" },
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return json({ error: error.message }, { status: 401 });
    }

    if (error instanceof Response) {
      return error;
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
          <h2 className="text-center text-3xl font-bold">Admin Portal</h2>
          <p className="text-center text-gray-600 mt-2">Sign in as admin or staff</p>
        </div>
        <Form method="post" className="space-y-6">
          <div>
            <Input name="email" type="email" required placeholder="Email" className="w-full" />
          </div>
          {actionData?.error && <div className="text-red-500 text-sm">{actionData.error}</div>}
          {redirectTo && <input type="hidden" name="redirectTo" value={redirectTo} />}
          <Button type="submit" className="w-full">
            Send verification code
          </Button>
        </Form>
      </div>
    </div>
  );
}
