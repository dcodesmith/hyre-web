import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentUserProfile } = vi.hoisted(() => ({
  getCurrentUserProfile: vi.fn(),
}));

vi.mock("~/api/users/users.server", () => ({
  getCurrentUserProfile,
}));

import { ApiRequestError } from "~/api/api.server";
import { redirectAuthenticatedUser } from "./guest-only.server";

const session = "better-auth.session_token=session-1";

function profile(phoneVerified: boolean) {
  return {
    data: {
      name: "Ada Lovelace",
      phoneNumber: "+2348012345678",
      phoneVerified,
      city: null,
      address: null,
      marketingConsent: false,
    },
  };
}

async function redirectOf(request: Request) {
  try {
    await redirectAuthenticatedUser(request);
  } catch (error) {
    return error;
  }

  return undefined;
}

describe("redirectAuthenticatedUser", () => {
  beforeEach(() => {
    getCurrentUserProfile.mockReset();
  });

  it("leaves guests on guest-only routes", async () => {
    await expect(
      redirectAuthenticatedUser(new Request("https://tripdly.com/auth")),
    ).resolves.toBeUndefined();
    await expect(
      redirectAuthenticatedUser(
        new Request("https://tripdly.com/auth", { headers: { Cookie: "otp_pending=1" } }),
      ),
    ).resolves.toBeUndefined();

    expect(getCurrentUserProfile).not.toHaveBeenCalled();
  });

  it("sends a verified user to the safe requested path", async () => {
    getCurrentUserProfile.mockResolvedValue(profile(true));

    const response = await redirectOf(
      new Request("https://tripdly.com/auth?redirectTo=%2Fcars%2Flexus-ux", {
        headers: { Cookie: session },
      }),
    );

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(302);
    expect((response as Response).headers.get("Location")).toBe("/cars/lexus-ux");
    expect((response as Response).headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("sends an unverified user to phone verification and keeps a safe redirect", async () => {
    getCurrentUserProfile.mockResolvedValue(profile(false));

    const response = await redirectOf(
      new Request("https://tripdly.com/verify?redirectTo=%2Fcars%2Flexus-ux%3Ffrom%3D2026-09-01", {
        headers: { Cookie: session },
      }),
    );

    expect((response as Response).headers.get("Location")).toBe(
      "/verify-phone?redirectTo=%2Fcars%2Flexus-ux%3Ffrom%3D2026-09-01",
    );
  });

  it("drops unsafe redirect targets for verified and unverified users", async () => {
    getCurrentUserProfile.mockResolvedValueOnce(profile(true));
    const verified = await redirectOf(
      new Request("https://tripdly.com/auth?redirectTo=%2F%2Fevil.example", {
        headers: { Cookie: session },
      }),
    );
    expect((verified as Response).headers.get("Location")).toBe("/");

    getCurrentUserProfile.mockResolvedValueOnce(profile(false));
    const unverified = await redirectOf(
      new Request("https://tripdly.com/auth?redirectTo=https%3A%2F%2Fevil.example", {
        headers: { Cookie: session },
      }),
    );
    expect((unverified as Response).headers.get("Location")).toBe("/verify-phone");
  });

  it("treats an unauthorized profile lookup as a guest", async () => {
    getCurrentUserProfile.mockRejectedValue(
      new ApiRequestError("http", 401, {
        type: "UNAUTHORIZED",
        title: "Unauthorized",
        status: 401,
        detail: "Sign in again.",
      }),
    );

    await expect(
      redirectAuthenticatedUser(
        new Request("https://tripdly.com/auth", { headers: { Cookie: session } }),
      ),
    ).resolves.toBeUndefined();
  });

  it("does not hide profile lookup failures", async () => {
    const error = new Error("API unavailable");
    getCurrentUserProfile.mockRejectedValue(error);

    await expect(
      redirectAuthenticatedUser(
        new Request("https://tripdly.com/auth", { headers: { Cookie: session } }),
      ),
    ).rejects.toBe(error);
  });
});
