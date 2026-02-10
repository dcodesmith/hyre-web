import { ActionFunctionArgs } from "@remix-run/node";
import logger from "~/lib/logger.server";
import { requireUser } from "~/modules/auth/auth.server";
import { deleteUserAccount } from "~/services/account-deletion.server";
import { validateCSRF } from "~/utils/csrf-action.server";

/**
 * API endpoint for account deletion (NDPC right to erasure)
 * POST /api/account/delete
 */
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    await validateCSRF(request);

    const user = await requireUser(request, { redirectTo: "/auth" });

    logger.info("Account deletion requested", { userId: user.id, email: user.email });

    await deleteUserAccount(user.id);

    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    logger.error("Account deletion failed", { error });

    if (error instanceof Error && error.message === "User not found") {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    return Response.json({ error: "Failed to delete account" }, { status: 500 });
  }
}
