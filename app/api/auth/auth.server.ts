import { env } from "cloudflare:workers";

import { authReferer } from "~/auth/referer";
import { ApiRequestError, createApiClient } from "../api.server";
import type { AuthRole } from "./schema";
import {
  sendOtpResponseSchema,
  sessionResponseSchema,
  signInResponseSchema,
  signOutResponseSchema,
} from "./schema";

let apiClient: ReturnType<typeof createApiClient> | undefined;

function getApiClient() {
  apiClient ??= createApiClient({ apiOrigin: env.API_ORIGIN });

  return apiClient;
}

function authHeaders(role: AuthRole) {
  return {
    origin: env.APP_ORIGIN,
    referer: authReferer(env.APP_ORIGIN, role),
  };
}

export function sendSignInOtp(options: {
  request?: Request;
  email: string;
  role: AuthRole;
  referralCode?: string;
}) {
  return getApiClient().request({
    path: "/api/auth/email-otp/send-verification-otp",
    method: "POST",
    request: options.request,
    headers: authHeaders(options.role),
    json: {
      email: options.email,
      type: "sign-in",
      role: options.role,
      ...(options.referralCode ? { referralCode: options.referralCode } : {}),
    },
    schema: sendOtpResponseSchema,
  });
}

export function verifySignInOtp(options: {
  request?: Request;
  email: string;
  otp: string;
  role: AuthRole;
}) {
  return getApiClient().request({
    path: "/api/auth/sign-in/email-otp",
    method: "POST",
    request: options.request,
    headers: authHeaders(options.role),
    json: {
      email: options.email,
      otp: options.otp,
      role: options.role,
    },
    schema: signInResponseSchema,
  });
}

export async function getAuthSession(options: { request: Request }) {
  try {
    return await getApiClient().request({
      path: "/auth/session",
      request: options.request,
      forwardCookie: true,
      schema: sessionResponseSchema,
    });
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 401) {
      return null;
    }

    throw error;
  }
}

export function signOut(options: { request: Request }) {
  return getApiClient().request({
    path: "/api/auth/sign-out",
    method: "POST",
    request: options.request,
    forwardCookie: true,
    headers: authHeaders("user"),
    json: {},
    schema: signOutResponseSchema,
  });
}

export function isSecureAuthCookie() {
  return env.APP_ENV !== "local";
}
