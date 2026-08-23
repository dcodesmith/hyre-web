import { type PendingOtp, pendingOtpSchema } from "./auth-form-schema";

export const PENDING_OTP_MAX_AGE_SECONDS = 600;

export function pendingOtpCookieName(secure: boolean) {
  return secure ? "__Host-otp_pending" : "otp_pending";
}

export function serializePendingOtp(value: PendingOtp) {
  return encodeURIComponent(JSON.stringify(value));
}

export function parsePendingOtp(value: string | undefined) {
  if (!value) {
    return null;
  }

  try {
    return pendingOtpSchema.parse(JSON.parse(decodeURIComponent(value)));
  } catch {
    return null;
  }
}

export function readCookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) {
    return undefined;
  }

  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");

    if (separator === -1) {
      continue;
    }

    if (part.slice(0, separator).trim() === name) {
      return part.slice(separator + 1).trim();
    }
  }

  return undefined;
}

export function pendingOtpSetCookie(value: PendingOtp, secure: boolean) {
  const attributes = [
    `${pendingOtpCookieName(secure)}=${serializePendingOtp(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${PENDING_OTP_MAX_AGE_SECONDS}`,
  ];

  if (secure) {
    attributes.push("Secure");
  }

  return attributes.join("; ");
}

export function pendingOtpClearCookie(secure: boolean) {
  const attributes = [
    `${pendingOtpCookieName(secure)}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];

  if (secure) {
    attributes.push("Secure");
  }

  return attributes.join("; ");
}
