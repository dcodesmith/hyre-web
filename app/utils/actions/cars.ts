import { prisma } from "~/modules/db/db.server";

export async function deleteCar(id: string) {
  try {
    await prisma.car.delete({
      where: { id },
    });
    return { success: true };
  } catch (error) {
    console.error("Failed to delete car:", error);
    return { error: "Failed to delete car" };
  }
}
