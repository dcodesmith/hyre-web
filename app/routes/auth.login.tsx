import { ActionFunction, json, LoaderFunctionArgs } from "@remix-run/node";
import { totpAuthenticator } from "../modules/auth/totp.server";
import { commitSession, getSession } from "../modules/auth/session.server";
import { authenticator } from "../modules/auth/auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  console.log("login loader");
  await totpAuthenticator.isAuthenticated(request, {
    successRedirect: "/",
    // failureRedirect: "/login",
  });
  console.log("login loader end");

  const cookie = await getSession(request.headers.get("Cookie"));
  const authEmail = cookie.get("auth:email");
  const authError = cookie.get(authenticator.sessionErrorKey);

  return json({ authEmail, authError } as const, {
    headers: {
      "Set-Cookie": await commitSession(cookie),
    },
  });
}

export const action: ActionFunction = async ({ request }) => {
  const url = new URL(request.url);
  const pathname = url.pathname;
  //   const formData = await request.formData();
  //   const email = formData.get("email");

  //   if (!email || typeof email !== "string") {
  //     return json({ error: "Email is required" }, { status: 400 });
  //   }

  //   console.log("login", { email });

  //   {
  //     successRedirect: "/root",
  //     failureRedirect: pathname,
  //   }

  try {
    const user = await totpAuthenticator.authenticate("TOTP", request, {
      successRedirect: "/root",
      failureRedirect: pathname,
    });

    console.log("login action success", user);

    return json({ success: true, email: "" });
  } catch (error) {
    if (error instanceof Response) {
      console.log("error here", error);
      // @!@ FLOWS HERE @!@
      //   return error;
      return json({ success: true, email: "" });

      //   return null;
    }

    return json({ error: "Failed to send verification code" }, { status: 500 });
  }
};
