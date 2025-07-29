import type { User } from "@prisma/client";
import { Authenticator } from "remix-auth";
import { TOTPStrategy } from "remix-auth-totp";
import { prisma } from "../db/db.server";
import { sessionStorage } from "./session.server";
import { env } from "~/utils/server/env.server";

export const totpAuthenticator = new Authenticator<User>(sessionStorage);

const totpStrategy = new TOTPStrategy(
  {
    secret: env.ENCRYPTION_SECRET || "NOT_A_STRONG_SECRET",
    sendTOTP: async ({ email, code }) => {
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        throw new Error("User not found");
      }
    },
  },
  async ({ email }) => {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new Error("User not found");
    }

    return user;
  },
);

totpAuthenticator.use(totpStrategy);
