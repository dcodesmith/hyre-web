import { ActionFunction, json } from "@remix-run/node";
import { totpAuthenticator } from "../modules/auth/totp.server";

export const action: ActionFunction = async ({ request }) => {
  try {
    return await totpAuthenticator.authenticate("TOTP", request, {
      successRedirect: "/",
      failureRedirect: "/root",
    });
  } catch (error) {
    console.log("verify action error", error);
    return json({ error: "Invalid verification code" }, { status: 400 });
  }
};
