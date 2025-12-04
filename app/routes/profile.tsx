import { parseWithZod } from "@conform-to/zod";
import { ActionFunctionArgs, data } from "@remix-run/node";
import logger from "~/lib/logger.server";
import { requireUser } from "~/modules/auth/auth.server";
import { prisma } from "~/modules/db/db.server";
import { profileFormSchema } from "~/schemas/user";
import { validateCSRF } from "~/utils/csrf-action.server";

export async function action({ request }: ActionFunctionArgs) {
  await validateCSRF(request);

  const user = await requireUser(request, {
    redirectTo: "/auth",
  });

  const formData = await request.formData();
  const intentValue = formData.get("intent");
  const intent = typeof intentValue === "string" ? intentValue : "";

  if (intent === "update") {
    const submission = parseWithZod(formData, { schema: profileFormSchema });

    if (submission.status !== "success") {
      return data(submission.reply());
    }

    try {
      await prisma.user.update({
        where: { id: user.id },
        data: submission.value,
      });

      return { success: true };
    } catch (error) {
      logger.error("Failed to update profile", { error });
      return data({ success: false, error: "Failed to update profile" }, { status: 500 });
    }
  }

  return data({ error: "Invalid intent" }, { status: 400 });
}
