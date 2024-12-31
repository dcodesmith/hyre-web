import { Authenticator } from "remix-auth";
import { TOTPStrategy } from "remix-auth-totp";
import { sessionStorage } from "./session.server";
import type { User } from "@prisma/client";
import { prisma } from "../db/db.server";

export const totpAuthenticator = new Authenticator<User>(sessionStorage);

const totpStrategy = new TOTPStrategy(
  {
    secret: process.env.ENCRYPTION_SECRET || "NOT_A_STRONG_SECRET",
    sendTOTP: async ({ email, code }) => {
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        throw new Error("User not found");
      }

      // Here you would implement your email sending logic
      console.log(`Sending code ${code} to ${email}`);
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
