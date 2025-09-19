import { createCookie } from "@remix-run/node";
import { env } from "./server/env.server";
import { CSRF, CSRFError } from "remix-utils/csrf/server";

const sessionSecret = env.SESSION_SECRET;

const cookie = createCookie(process.env.NODE_ENV === "production" ? "__Host-csrf" : "csrf", {
  path: "/",
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  secrets: [sessionSecret],
});

export const csrf = new CSRF({
  cookie,
  formDataKey: "csrf",
  secret: sessionSecret,
});

export { CSRFError };
