import { beforeEach, describe, expect, it, vi } from "vitest";

const { redirectAuthenticatedAdmin, sendSignInOtp, signOut, verifySignInOtp } = vi.hoisted(() => ({
  redirectAuthenticatedAdmin: vi.fn(),
  sendSignInOtp: vi.fn(),
  signOut: vi.fn(),
  verifySignInOtp: vi.fn(),
}));

vi.mock("~/auth/admin-session.server", () => ({
  redirectAuthenticatedAdmin,
}));

vi.mock("cloudflare:workers", () => ({
  env: {
    API_ORIGIN: "https://api.example",
    APP_ORIGIN: "https://tripdly.com",
  },
}));

vi.mock("~/api/auth/auth.server", () => ({
  isSecureAuthCookie: () => false,
  sendSignInOtp,
  signOut,
  verifySignInOtp,
}));

import { serializePendingOtp } from "~/auth/pending-otp";
import { action as loginAction, loader as loginLoader } from "./admin.login";
import { action as logoutAction } from "./admin.logout";
import { action as verifyAction, loader as verifyLoader } from "./admin.verify";

function routeArgs(request: Request) {
  return { request, params: {} } as never;
}

describe("admin authentication routes", () => {
  beforeEach(() => {
    redirectAuthenticatedAdmin.mockReset();
    redirectAuthenticatedAdmin.mockResolvedValue(undefined);
    sendSignInOtp.mockReset();
    signOut.mockReset();
    verifySignInOtp.mockReset();
  });

  it("uses the requested portal role as the login default", async () => {
    const result = await loginLoader(
      routeArgs(new Request("https://tripdly.com/admin/login?role=staff")),
    );

    expect(result).toEqual({ defaultRole: "staff" });
  });

  it("requests a staff OTP and stores its role in the admin pending cookie", async () => {
    sendSignInOtp.mockResolvedValue({
      data: { success: true },
      status: 200,
      headers: new Headers(),
    });
    const request = new Request("https://tripdly.com/admin/login?redirectTo=%2Fadmin%2Fcars", {
      method: "POST",
      body: new URLSearchParams({
        email: "staff@example.com",
        role: "staff",
        acceptTerms: "on",
      }),
    });

    const response = await loginAction(routeArgs(request)).catch((error: unknown) => error);

    expect(sendSignInOtp).toHaveBeenCalledWith({
      request,
      email: "staff@example.com",
      role: "staff",
    });
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get("location")).toBe(
      "/admin/verify?redirectTo=%2Fadmin%2Fcars",
    );
    expect((response as Response).headers.getSetCookie()).toEqual([
      expect.stringContaining("admin_otp_pending="),
    ]);
    expect(decodeURIComponent((response as Response).headers.getSetCookie()[0])).toContain(
      '"role":"staff"',
    );
  });

  it("verifies with the role stored in the admin pending cookie", async () => {
    const apiHeaders = new Headers();
    apiHeaders.append(
      "Set-Cookie",
      "better-auth.session_token=session-1; Path=/; HttpOnly; SameSite=Lax",
    );
    verifySignInOtp.mockResolvedValue({
      data: {
        user: { id: "staff-1", email: "staff@example.com", roles: ["staff"] },
      },
      status: 200,
      headers: apiHeaders,
    });
    const request = new Request("https://tripdly.com/admin/verify?redirectTo=%2Fadmin%2Fcars", {
      method: "POST",
      headers: {
        Cookie: `admin_otp_pending=${serializePendingOtp({
          email: "staff@example.com",
          role: "staff",
        })}`,
      },
      body: new URLSearchParams({ intent: "verify", code: "123456" }),
    });

    const response = await verifyAction(routeArgs(request)).catch((error: unknown) => error);

    expect(verifySignInOtp).toHaveBeenCalledWith({
      request,
      email: "staff@example.com",
      otp: "123456",
      role: "staff",
    });
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get("location")).toBe("/admin/cars");
    expect((response as Response).headers.getSetCookie()).toEqual(
      expect.arrayContaining([
        expect.stringContaining("better-auth.session_token=session-1"),
        expect.stringContaining("admin_otp_pending=;"),
      ]),
    );
  });

  it("rejects a pending cookie without a role and preserves the protected target", async () => {
    const request = new Request("https://tripdly.com/admin/verify?redirectTo=%2Fadmin%2Fcars", {
      headers: {
        Cookie: `admin_otp_pending=${serializePendingOtp({
          email: "admin@example.com",
        })}`,
      },
    });

    const response = await verifyLoader(routeArgs(request)).catch((error: unknown) => error);

    expect(verifySignInOtp).not.toHaveBeenCalled();
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get("location")).toBe(
      "/admin/login?redirectTo=%2Fadmin%2Fcars",
    );
  });

  it("resends with the role stored in the pending cookie", async () => {
    sendSignInOtp.mockResolvedValue({
      data: { success: true },
      status: 200,
      headers: new Headers(),
    });
    const request = new Request("https://tripdly.com/admin/verify", {
      method: "POST",
      headers: {
        Cookie: `admin_otp_pending=${serializePendingOtp({
          email: "admin@example.com",
          role: "admin",
        })}`,
      },
      body: new URLSearchParams({ intent: "resend" }),
    });

    await verifyAction(routeArgs(request));

    expect(sendSignInOtp).toHaveBeenCalledWith({
      request,
      email: "admin@example.com",
      role: "admin",
    });
  });

  it("signs out through the admin Referer scope and clears local auth cookies", async () => {
    signOut.mockResolvedValue({
      data: null,
      status: 200,
      headers: new Headers(),
    });
    const request = new Request("https://tripdly.com/admin/logout", {
      method: "POST",
      headers: { Cookie: "better-auth.session_token=session-1" },
    });

    const response = await logoutAction(routeArgs(request)).catch((error: unknown) => error);

    expect(signOut).toHaveBeenCalledWith({ request, role: "admin" });
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get("location")).toBe("/admin/login");
    expect((response as Response).headers.getSetCookie()).toEqual(
      expect.arrayContaining([
        expect.stringContaining("better-auth.session_token=;"),
        expect.stringContaining("admin_otp_pending=;"),
      ]),
    );
  });
});
