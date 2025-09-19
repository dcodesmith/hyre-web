import type { ActionFunctionArgs } from "@remix-run/node";
import { data } from "@remix-run/node";
import invariant from "tiny-invariant";
import { requireUserWithRole } from "~/modules/auth/auth.server";
import { prisma } from "~/modules/db/db.server";
import { validateCSRF } from "~/utils/csrf-action.server";

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== "DELETE") {
    return data(
      { error: "Method not allowed" },
      { status: 405, headers: { Allow: "DELETE", "Cache-Control": "no-store" } },
    );
  }

  await validateCSRF(request);
  const user = await requireUserWithRole(request, "fleetOwner");
  const id = params.id;

  if (!id || typeof id !== "string") {
    return data(
      { error: "Invalid car id" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      const car = await tx.car.findUnique({
        where: { id },
        select: { ownerId: true },
      });

      if (!car) {
        throw new Response(null, { status: 404 });
      }

      if (car.ownerId !== user.id) {
        throw new Response(null, { status: 403 });
      }

      await tx.car.delete({ where: { id } });
    });
    return data({ success: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof Response) {
      const status = err.status;
      const error = status === 404 ? "Car not found" : "Forbidden";
      return data({ error }, { status, headers: { "Cache-Control": "no-store" } });
    }
    return data(
      { error: "Failed to delete car" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
