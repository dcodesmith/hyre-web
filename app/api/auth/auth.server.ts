import { env } from "cloudflare:workers";

import { authReferer } from "~/auth/referer";
import { ApiRequestError, createApiClient } from "../api.server";
import { HTTP_STATUS } from "../http-status";
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

export type SendSignInOtpOptions = {
  request?: Request;
  email: string;
  role: AuthRole;
  referralCode?: string;
};

export type VerifySignInOtpOptions = {
  request?: Request;
  email: string;
  otp: string;
  role: AuthRole;
};

export type GetAuthSessionOptions = {
  request: Request;
};

export type SignOutOptions = {
  request: Request;
  role: AuthRole;
};

function authHeaders(role: AuthRole) {
  return {
    origin: env.APP_ORIGIN,
    referer: authReferer(env.APP_ORIGIN, role),
  };
}

export function sendSignInOtp(options: SendSignInOtpOptions) {
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

export function verifySignInOtp(options: VerifySignInOtpOptions) {
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

export async function getAuthSession(options: GetAuthSessionOptions) {
  try {
    return await getApiClient().request({
      path: "/auth/session",
      request: options.request,
      forwardCookie: true,
      schema: sessionResponseSchema,
    });
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === HTTP_STATUS.UNAUTHORIZED) {
      return null;
    }

    throw error;
  }
}

export function signOut(options: SignOutOptions) {
  return getApiClient().request({
    path: "/api/auth/sign-out",
    method: "POST",
    request: options.request,
    forwardCookie: true,
    headers: authHeaders(options.role),
    json: {},
    schema: signOutResponseSchema,
  });
}

export function isSecureAuthCookie() {
  return env.APP_ORIGIN.startsWith("https://");
}
