import { beforeEach, describe, expect, it, vi } from "vitest";

const { redirectAuthenticatedFleetOwner, sendSignInOtp, signOut, verifySignInOtp } = vi.hoisted(
  () => ({
    redirectAuthenticatedFleetOwner: vi.fn(),
    sendSignInOtp: vi.fn(),
    signOut: vi.fn(),
    verifySignInOtp: vi.fn(),
  }),
);

vi.mock("~/auth/fleet-owner-session.server", () => ({
  redirectAuthenticatedFleetOwner,
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
import { action as loginAction } from "./fleet-owner.login";
import { action as logoutAction } from "./fleet-owner.logout";
import { action as verifyAction, loader as verifyLoader } from "./fleet-owner.verify";
import { action as customerVerifyAction } from "./verify";

function routeArgs(request: Request) {
  return { request, params: {} } as never;
}

describe("fleet-owner authentication routes", () => {
  beforeEach(() => {
    redirectAuthenticatedFleetOwner.mockReset();
    redirectAuthenticatedFleetOwner.mockResolvedValue(undefined);
    sendSignInOtp.mockReset();
    signOut.mockReset();
    verifySignInOtp.mockReset();
  });

  it("requests a fleet-owner OTP and stores a scoped pending cookie", async () => {
    sendSignInOtp.mockResolvedValue({
      data: { success: true },
      status: 200,
      headers: new Headers(),
    });
    const request = new Request(
      "https://tripdly.com/fleet-owner/login?redirectTo=%2Ffleet-owner%2Fcars",
      {
        method: "POST",
        body: new URLSearchParams({
          email: "owner@example.com",
          acceptTerms: "on",
        }),
      },
    );

    const response = await loginAction(routeArgs(request)).catch((error: unknown) => error);

    expect(sendSignInOtp).toHaveBeenCalledWith({
      request,
      email: "owner@example.com",
      role: "fleetOwner",
    });
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get("location")).toBe(
      "/fleet-owner/verify?redirectTo=%2Ffleet-owner%2Fcars",
    );
    expect((response as Response).headers.getSetCookie()).toEqual([
      expect.stringContaining("fleet_owner_otp_pending="),
    ]);
  });

  it("verifies with the fleet-owner role and relays API cookies", async () => {
    const apiHeaders = new Headers();
    apiHeaders.append(
      "Set-Cookie",
      "better-auth.session_token=session-1; Path=/; HttpOnly; SameSite=Lax",
    );
    verifySignInOtp.mockResolvedValue({
      data: {
        user: { id: "owner-1", email: "owner@example.com", roles: ["fleetOwner"] },
      },
      status: 200,
      headers: apiHeaders,
    });
    const request = new Request(
      "https://tripdly.com/fleet-owner/verify?redirectTo=%2Ffleet-owner%2Fcars",
      {
        method: "POST",
        headers: {
          Cookie: `fleet_owner_otp_pending=${serializePendingOtp({
            email: "owner@example.com",
          })}`,
        },
        body: new URLSearchParams({ intent: "verify", code: "123456" }),
      },
    );

    const response = await verifyAction(routeArgs(request)).catch((error: unknown) => error);

    expect(verifySignInOtp).toHaveBeenCalledWith({
      request,
      email: "owner@example.com",
      otp: "123456",
      role: "fleetOwner",
    });
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get("location")).toBe("/fleet-owner/cars");
    expect((response as Response).headers.getSetCookie()).toEqual(
      expect.arrayContaining([
        expect.stringContaining("better-auth.session_token=session-1"),
        expect.stringContaining("fleet_owner_otp_pending=;"),
      ]),
    );
  });

  it("does not accept a customer pending OTP on fleet verification", async () => {
    const request = new Request("https://tripdly.com/fleet-owner/verify", {
      method: "POST",
      headers: {
        Cookie: `otp_pending=${serializePendingOtp({ email: "customer@example.com" })}`,
      },
      body: new URLSearchParams({ intent: "verify", code: "123456" }),
    });

    const response = await verifyAction(routeArgs(request)).catch((error: unknown) => error);

    expect(verifySignInOtp).not.toHaveBeenCalled();
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get("location")).toBe("/fleet-owner/login");
  });

  it("does not accept a fleet-owner pending OTP on customer verification", async () => {
    const request = new Request("https://tripdly.com/verify", {
      method: "POST",
      headers: {
        Cookie: `fleet_owner_otp_pending=${serializePendingOtp({ email: "owner@example.com" })}`,
      },
      body: new URLSearchParams({ intent: "verify", code: "123456" }),
    });

    const response = await customerVerifyAction(routeArgs(request)).catch(
      (error: unknown) => error,
    );

    expect(verifySignInOtp).not.toHaveBeenCalled();
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get("location")).toBe("/auth");
  });

  it("resends a fleet-owner OTP and refreshes the scoped pending cookie", async () => {
    sendSignInOtp.mockResolvedValue({
      data: { success: true },
      status: 200,
      headers: new Headers(),
    });
    const request = new Request("https://tripdly.com/fleet-owner/verify", {
      method: "POST",
      headers: {
        Cookie: `fleet_owner_otp_pending=${serializePendingOtp({
          email: "owner@example.com",
        })}`,
      },
      body: new URLSearchParams({ intent: "resend" }),
    });

    const result = await verifyAction(routeArgs(request));

    expect(sendSignInOtp).toHaveBeenCalledWith({
      request,
      email: "owner@example.com",
      role: "fleetOwner",
    });
    const resendHeaders = (result as { init?: ResponseInit }).init?.headers as Headers;
    expect(resendHeaders.getSetCookie()).toEqual([
      expect.stringContaining("fleet_owner_otp_pending="),
    ]);
  });

  it("redirects the fleet verification loader when no scoped OTP is pending", async () => {
    const request = new Request(
      "https://tripdly.com/fleet-owner/verify?redirectTo=%2Ffleet-owner%2Fcars",
    );

    const response = await verifyLoader(routeArgs(request)).catch((error: unknown) => error);

    expect(redirectAuthenticatedFleetOwner).toHaveBeenCalledWith(request);
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get("location")).toBe(
      "/fleet-owner/login?redirectTo=%2Ffleet-owner%2Fcars",
    );
  });

  it("signs out with the fleet-owner Referer scope and clears local auth cookies", async () => {
    signOut.mockResolvedValue({
      data: null,
      status: 200,
      headers: new Headers(),
    });
    const request = new Request("https://tripdly.com/fleet-owner/logout", {
      method: "POST",
      headers: { Cookie: "better-auth.session_token=session-1" },
    });

    const response = await logoutAction(routeArgs(request)).catch((error: unknown) => error);

    expect(signOut).toHaveBeenCalledWith({ request, role: "fleetOwner" });
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get("location")).toBe("/fleet-owner/login");
    expect((response as Response).headers.getSetCookie()).toEqual(
      expect.arrayContaining([
        expect.stringContaining("better-auth.session_token=;"),
        expect.stringContaining("fleet_owner_otp_pending=;"),
      ]),
    );
  });
});
