import { ActionFunctionArgs, json } from "@remix-run/node";
import { prisma } from "~/modules/db/db.server";

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== "DELETE") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    await prisma.car.delete({
      where: { id: params.id },
    });

    return json({ success: true });
  } catch (error) {
    return json({ error: "Failed to delete car" }, { status: 500 });
  }
}
