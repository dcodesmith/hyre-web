import type { Prisma } from "@prisma/client";
import { prisma } from "~/modules/db/db.server";

export async function createUser(data: Prisma.UserCreateInput) {
  return prisma.user.create({
    data,
  });
}
