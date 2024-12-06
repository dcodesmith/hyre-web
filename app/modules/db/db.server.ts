import { PrismaClient } from "@prisma/client";
import { singleton } from "~/utils/misc.server";

const prisma = singleton("prisma", () => new PrismaClient());

export { prisma };
