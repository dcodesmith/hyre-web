import { Authenticator } from "remix-auth";
import { TOTPStrategy } from "remix-auth-totp";
import { sessionStorage } from "./session.server";
import { sendAuthEmail } from "~/modules/email/email.server";
import { prisma } from "~/modules/db/db.server";
import { redirect } from "@remix-run/node";
import type { User } from "@prisma/client";
import { userHasRole } from "~/utils/misc";

export const authenticator = new Authenticator<User>(sessionStorage, {
  sessionErrorKey: "my-error-key",
});

const totpStrategy = new TOTPStrategy(
  {
    secret: process.env.ENCRYPTION_SECRET || "NOT_A_STRONG_SECRET",
    magicLinkPath: "/magic-link",
    sendTOTP: async ({ email, code, magicLink }) => {
      console.log({ email, code, magicLink, env: process.env.NODE_ENV });
      if (process.env.NODE_ENV === "development") {
        // Development Only: Log the TOTP code.
        console.log("[ Dev-Only ] TOTP Code:", code);

        // Email is not sent for admin users.
        if (email.startsWith("admin") || email.endsWith("@fleetowner.com")) {
          console.log("Not sending email for admin and fleet owner users.");
          return;
        }
      }

      await sendAuthEmail({ email, code, magicLink });
    },
    validateEmail: async () => {
      // Implement your email validation logic here
      // For now, we'll just return true
      return true;
    },
  },
  async ({ email }) => {
    let user = await prisma.user.findUnique({
      where: { email },
      include: {
        roles: { select: { name: true } },
      },
    });

    if (!user) {
      user = await prisma.user.create({
        data: { email, roles: { connect: [{ name: "user" }] } },
        include: { roles: true },
      });
    }

    return user;
  }
);

authenticator.use(totpStrategy);

/**
 * Utilities.
 */
export async function requireSessionUser(
  request: Request,
  { redirectTo }: { redirectTo?: string | null } = {}
) {
  const sessionUser = await authenticator.isAuthenticated(request);

  if (!sessionUser) {
    if (!redirectTo) {
      throw redirect("/logout");
    }

    throw redirect(redirectTo);
  }

  return sessionUser;
}

export async function requireUser(
  request: Request,
  { redirectTo }: { redirectTo?: string | null } = {}
) {
  const sessionUser = await authenticator.isAuthenticated(request);

  const user = sessionUser?.id
    ? await prisma.user.findUnique({
        where: { id: sessionUser.id },
        include: {
          roles: { select: { name: true } },
        },
      })
    : null;

  if (!user) {
    if (!redirectTo) {
      throw redirect("/logout");
    }

    console.log({ redirectTo });
    throw redirect(redirectTo);
  }

  return user;
}

export async function requireAdmin(request: Request) {
  const user = await requireUser(request);

  if (!userHasRole(user, "admin")) {
    throw redirect("/");
  }
}
