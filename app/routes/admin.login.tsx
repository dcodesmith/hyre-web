import { parseWithZod } from "@conform-to/zod";
import { type ActionFunctionArgs, type LoaderFunctionArgs, data, redirect } from "@remix-run/node";
import { useActionData } from "@remix-run/react";
import { AuthorizationError } from "remix-auth";
import { z } from "zod";
import { Form } from "~/components/CSRFForm";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import logger from "~/lib/logger.server";
import { authenticator } from "~/modules/auth/auth.server";
import { prisma } from "~/modules/db/db.server";
import { validateCSRF } from "~/utils/csrf-action.server";
import { safeRedirect } from "~/utils/safe-redirect";

const AdminLoginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await authenticator.isAuthenticated(request);

  if (user) {
    return redirect("/admin");
  }

  return null;
}

export async function action({ request }: ActionFunctionArgs) {
  await validateCSRF(request);

  const formData = await request.clone().formData();
  const submission = parseWithZod(formData, { schema: AdminLoginSchema });

  if (submission.status !== "success") {
    return data({ error: "Invalid form data", submission: submission.reply() }, { status: 400 });
  }

  const { email } = submission.value;

  // Safely validate redirectTo from URL search params
  const url = new URL(request.url);
  const redirectTo = safeRedirect(url.searchParams.get("redirectTo"), "");

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
      return data({ error: "Invalid credentials" }, { status: 401 });
    }

    const isAdmin = user.roles.some((role) => role.name === "admin");
    const isStaff = user.roles.some((role) => role.name === "staff");

    if (!isAdmin && !isStaff) {
      logger.warn(
        `Unauthorized access: ${email}, roles=[${user.roles.map((r) => r.name).join(",")}]`,
      );
    }

    // Build the verify URL with appropriate parameters
    const verifyParams = new URLSearchParams();
    if (redirectTo) {
      verifyParams.set("redirectTo", redirectTo);
    }
    verifyParams.set("role", isAdmin ? "admin" : "staff");

    logger.info(`Authenticating admin/staff, email: ${email}`);
    return authenticator.authenticate("TOTP", request, {
      successRedirect: `/admin/verify?${verifyParams.toString()}`,
      failureRedirect: "/admin/login",
      context: { role: isAdmin ? "admin" : "staff" },
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return data({ error: error.message }, { status: 401 });
    }

    if (error instanceof Response) {
      return error;
    }

    logger.error({ error }, "Admin login failed");
    return data({ error: "Something went wrong" }, { status: 500 });
  }
}

export default function AdminLogin() {
  const actionData = useActionData<typeof action>();

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
          <Button type="submit" className="w-full">
            Send verification code
          </Button>
        </Form>
      </div>
    </div>
  );
}
