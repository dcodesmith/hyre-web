import { beforeEach, describe, expect, it, vi } from "vitest";

const { verifySignInOtp } = vi.hoisted(() => ({
  verifySignInOtp: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({
  env: {
    API_ORIGIN: "https://api.example",
    APP_ORIGIN: "https://tripdly.com",
  },
}));

vi.mock("~/api/auth/auth.server", () => ({
  isSecureAuthCookie: () => false,
  verifySignInOtp,
}));

import { serializePendingOtp } from "~/auth/pending-otp";
import { action } from "./verify";

function routeArgs(request: Request) {
  return { request, params: {} } as never;
}

describe("customer email verification", () => {
  beforeEach(() => {
    verifySignInOtp.mockReset();
  });

  it("sends a successful email OTP to phone verification and keeps redirectTo", async () => {
    const apiHeaders = new Headers();
    apiHeaders.append(
      "Set-Cookie",
      "better-auth.session_token=session-1; Path=/; HttpOnly; SameSite=Lax",
    );
    verifySignInOtp.mockResolvedValue({
      data: {
        user: {
          id: "018f47a2-7b3c-7d4e-8f90-123456789461",
          email: "ada@example.com",
          roles: ["user"],
        },
      },
      status: 200,
      headers: apiHeaders,
    });
    const request = new Request(
      "https://tripdly.com/verify?redirectTo=%2Fcars%2Flexus-ux%3Ffrom%3D2026-09-01",
      {
        method: "POST",
        headers: {
          Cookie: `otp_pending=${serializePendingOtp({ email: "ada@example.com" })}`,
        },
        body: new URLSearchParams({ intent: "verify", code: "123456" }),
      },
    );

    const response = await action(routeArgs(request)).catch((error: unknown) => error);

    expect(verifySignInOtp).toHaveBeenCalledWith({
      request,
      email: "ada@example.com",
      otp: "123456",
      role: "user",
    });
    expect(response).toBeInstanceOf(Response);
    const location = new URL(
      (response as Response).headers.get("location") ?? "",
      "https://tripdly.com",
    );
    expect(location.pathname).toBe("/verify-phone");
    expect(location.searchParams.get("redirectTo")).toBe("/cars/lexus-ux?from=2026-09-01");
  });

  it("does not carry an unsafe redirect into the phone step", async () => {
    verifySignInOtp.mockResolvedValue({
      data: {
        user: {
          id: "018f47a2-7b3c-7d4e-8f90-123456789461",
          email: "ada@example.com",
          roles: ["user"],
        },
      },
      status: 200,
      headers: new Headers(),
    });
    const request = new Request("https://tripdly.com/verify?redirectTo=%2F%2Fevil.example", {
      method: "POST",
      headers: {
        Cookie: `otp_pending=${serializePendingOtp({ email: "ada@example.com" })}`,
      },
      body: new URLSearchParams({ intent: "verify", code: "123456" }),
    });

    const response = await action(routeArgs(request)).catch((error: unknown) => error);

    expect((response as Response).headers.get("location")).toBe("/verify-phone");
  });
});
