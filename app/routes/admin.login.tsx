import { parseWithZod } from "@conform-to/zod/v4";
import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  data,
  redirect,
  useActionData,
} from "react-router";
import { Form } from "~/components/CSRFForm";
import { AdminLoginSchema } from "~/schemas/auth.schema";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import logger from "~/lib/logger.server";
import { getSessionUser } from "~/modules/auth/auth.server";
import { prisma } from "~/modules/db/db.server";
import { userHasRole } from "~/utils/shared/roles";
import { validateCSRF } from "~/utils/csrf-action.server";
import { safeRedirect } from "~/utils/safe-redirect";
import { sendOTPAndRedirect } from "~/utils/server/auth-helpers.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getSessionUser(request);

  if (user && (userHasRole(user, "admin") || userHasRole(user, "staff"))) {
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

    // Prevent user enumeration by using the same error message for both cases
    if (!user) {
      logger.warn("Admin login attempt for non-existent user", { email });
      return data(
        { error: "We couldn't start the login process. Please check your details and try again." },
        { status: 400 },
      );
    }

    const isAdmin = userHasRole(user, "admin");
    const isStaff = userHasRole(user, "staff");

    if (!isAdmin && !isStaff) {
      // Log security event without revealing information to the user
      logger.warn("User attempted admin login with wrong role", {
        email,
        actualRoles: user.roles.map((r) => r.name),
      });
      return data(
        { error: "We couldn't start the login process. Please check your details and try again." },
        { status: 400 },
      );
    }

    const role = isAdmin ? ("admin" as const) : ("staff" as const);
    logger.info(`Authenticating admin/staff, email: ${email}, role: ${role}`);

    // Send OTP and redirect to verify page
    return sendOTPAndRedirect(request, email, role, redirectTo);
  } catch (error) {
    logger.error({ error }, "Admin login failed");

    // For same-route failures, only return actionData.error
    // Don't set auth:error cookie to avoid duplication and stale state
    return data(
      { error: error instanceof Error ? error.message : "Something went wrong" },
      { status: 500 },
    );
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
