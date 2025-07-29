import { parseWithZod } from "@conform-to/zod";
import { ActionFunctionArgs, json } from "@remix-run/node";
import { authenticator } from "~/modules/auth/auth.server";
import { prisma } from "~/modules/db/db.server";
import { profileFormSchema } from "~/schemas/user";
import { validateCSRF } from "~/utils/csrf-action.server";

export async function action({ request }: ActionFunctionArgs) {
  await validateCSRF(request);

  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/auth",
  });

  const formData = await request.formData();
  const intent = String(formData.get("intent"));

  if (intent === "update") {
    const submission = parseWithZod(formData, { schema: profileFormSchema });

    if (submission.status !== "success") {
      return json(submission.reply());
    }

    try {
      await prisma.user.update({
        where: { id: user.id },
        data: submission.value,
      });

      return json({ success: true });
    } catch (error) {
      return json({ success: false, error: "Failed to update profile" }, { status: 500 });
    }
  }

  return json({ error: "Invalid intent" }, { status: 400 });
}
