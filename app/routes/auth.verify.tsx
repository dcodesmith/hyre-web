import { ActionFunction, data } from "@remix-run/node";
import { totpAuthenticator } from "../modules/auth/totp.server";

export const action: ActionFunction = async ({ request }) => {
  try {
    return await totpAuthenticator.authenticate("TOTP", request, {
      successRedirect: "/",
      failureRedirect: "/root",
    });
  } catch (error) {
    return data(
      { error: "Invalid verification code" },
      { status: 400, headers: { "Cache-Control": "no-store, private" } },
    );
  }
};
