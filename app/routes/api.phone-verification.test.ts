import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getCurrentUserProfile,
  sendCurrentUserPhoneVerification,
  checkCurrentUserPhoneVerification,
  sendGuestPhoneVerification,
  checkGuestPhoneVerification,
  readAuthUser,
} = vi.hoisted(() => ({
  getCurrentUserProfile: vi.fn(),
  sendCurrentUserPhoneVerification: vi.fn(),
  checkCurrentUserPhoneVerification: vi.fn(),
  sendGuestPhoneVerification: vi.fn(),
  checkGuestPhoneVerification: vi.fn(),
  readAuthUser: vi.fn(),
}));

vi.mock("~/api/users/users.server", () => ({
  getCurrentUserProfile,
  sendCurrentUserPhoneVerification,
  checkCurrentUserPhoneVerification,
  sendGuestPhoneVerification,
  checkGuestPhoneVerification,
}));

vi.mock("~/auth/session.server", () => ({ readAuthUser }));

import { ApiRequestError } from "~/api/api.server";
import { HTTP_STATUS } from "~/api/http-status";
import { action, loader } from "./api.phone-verification";

function apiError(
  status: number,
  detail: string,
  kind: "aborted" | "http" = "http",
  errorCode?: string,
) {
  return new ApiRequestError(kind, status, {
    type: "PHONE_ERROR",
    title: "Phone error",
    status,
    detail,
    errorCode,
  });
}

function runLoader(cookie = "better-auth.session_token=session-1") {
  return loader({
    request: new Request("https://tripdly.com/api/phone-verification", {
      headers: cookie ? { cookie } : {},
    }),
    params: {},
    context: {},
  } as Parameters<typeof loader>[0]);
}

function runAction(body: Record<string, string>, cookie = "better-auth.session_token=session-1") {
  return action({
    request: new Request("https://tripdly.com/api/phone-verification", {
      method: "POST",
      headers: cookie ? { cookie } : {},
      body: new URLSearchParams(body),
    }),
    params: {},
    context: {},
  } as Parameters<typeof action>[0]);
}

describe("phone verification resource", () => {
  beforeEach(() => {
    getCurrentUserProfile.mockReset();
    sendCurrentUserPhoneVerification.mockReset();
    checkCurrentUserPhoneVerification.mockReset();
    sendGuestPhoneVerification.mockReset();
    checkGuestPhoneVerification.mockReset();
    readAuthUser.mockReset();
    readAuthUser.mockResolvedValue({ email: "ada@example.com", name: "Ada" });
  });

  it("returns unverified when the request has no session", async () => {
    await expect(runLoader("")).resolves.toMatchObject({
      data: { phoneVerified: false, intent: null, error: null },
    });
    expect(getCurrentUserProfile).not.toHaveBeenCalled();
  });

  it("returns the unverified number for a signed-in profile", async () => {
    getCurrentUserProfile.mockResolvedValue({
      data: {
        name: "Ada",
        phoneNumber: "+2348012345678",
        phoneVerified: false,
        city: null,
        address: null,
        marketingConsent: false,
      },
    });

    await expect(runLoader()).resolves.toMatchObject({
      data: {
        intent: null,
        phoneNumber: "+2348012345678",
        phoneVerified: false,
        error: null,
      },
    });
  });

  it("hides the row when the profile is already verified", async () => {
    getCurrentUserProfile.mockResolvedValue({
      data: {
        name: "Ada",
        phoneNumber: "+2348012345678",
        phoneVerified: true,
        city: null,
        address: null,
        marketingConsent: false,
      },
    });

    await expect(runLoader()).resolves.toMatchObject({
      data: { phoneVerified: true, phoneNumber: "+2348012345678", intent: null },
    });
  });

  it("returns unverified when the profile request is unauthorized", async () => {
    getCurrentUserProfile.mockRejectedValue(apiError(HTTP_STATUS.UNAUTHORIZED, "Unauthorized"));

    await expect(runLoader()).resolves.toMatchObject({
      data: { phoneVerified: false, intent: null },
    });
  });

  it("rethrows an aborted profile request", async () => {
    const aborted = apiError(HTTP_STATUS.CLIENT_CLOSED_REQUEST, "Aborted", "aborted");
    getCurrentUserProfile.mockRejectedValue(aborted);

    await expect(runLoader()).rejects.toBe(aborted);
  });

  it("sends a code and returns the masked number", async () => {
    sendCurrentUserPhoneVerification.mockResolvedValue({
      data: { status: "PENDING", phoneNumber: "+234••••5678" },
    });

    await expect(
      runAction({ intent: "send-phone", phoneNumber: "+2348012345678" }),
    ).resolves.toMatchObject({
      data: {
        intent: "send-phone",
        phoneVerified: false,
        verificationToken: null,
        maskedPhoneNumber: "+234••••5678",
        notice: "Code sent to +234••••5678.",
        error: null,
      },
    });
    expect(sendCurrentUserPhoneVerification).toHaveBeenCalledOnce();
    expect(sendGuestPhoneVerification).not.toHaveBeenCalled();
  });

  it("sends a guest code when the session cookie does not resolve to a user", async () => {
    readAuthUser.mockResolvedValue(null);
    sendGuestPhoneVerification.mockResolvedValue({
      data: { status: "PENDING", phoneNumber: "+234••••5678" },
    });

    await expect(
      runAction({ intent: "send-phone", phoneNumber: "+2348012345678" }),
    ).resolves.toMatchObject({
      data: {
        intent: "send-phone",
        phoneVerified: false,
        verificationToken: null,
        notice: "Code sent to +234••••5678.",
      },
    });
    expect(sendGuestPhoneVerification).toHaveBeenCalledWith({
      request: expect.any(Request),
      phoneNumber: "+2348012345678",
    });
    expect(sendCurrentUserPhoneVerification).not.toHaveBeenCalled();
  });

  it("rejects a phone number that is not in international format", async () => {
    const result = await runAction({ intent: "send-phone", phoneNumber: "08012345678" });

    expect(result).toMatchObject({
      data: {
        intent: "send-phone",
        phoneVerified: false,
        fieldErrors: { phoneNumber: expect.any(Array) },
      },
      init: { status: HTTP_STATUS.BAD_REQUEST },
    });
    expect(sendCurrentUserPhoneVerification).not.toHaveBeenCalled();
  });

  it("marks the number verified when the code check succeeds", async () => {
    checkCurrentUserPhoneVerification.mockResolvedValue({
      data: { status: "VERIFIED", phoneNumber: "+2348012345678" },
    });

    await expect(
      runAction({
        intent: "check-phone",
        phoneNumber: "+2348012345678",
        code: "123456",
        maskedPhoneNumber: "+234••••5678",
      }),
    ).resolves.toMatchObject({
      data: {
        intent: "check-phone",
        phoneVerified: true,
        verificationToken: null,
        phoneNumber: "+2348012345678",
        notice: null,
      },
    });
    expect(checkGuestPhoneVerification).not.toHaveBeenCalled();
  });

  it("marks a guest verified only when the check returns a string proof", async () => {
    readAuthUser.mockResolvedValue(null);
    checkGuestPhoneVerification.mockResolvedValue({
      data: { status: "VERIFIED", phoneNumber: "+2348012345678" },
    });

    await expect(
      runAction({
        intent: "check-phone",
        phoneNumber: "+2348012345678",
        code: "123456",
      }),
    ).resolves.toMatchObject({
      data: { phoneVerified: false, verificationToken: null },
    });

    checkGuestPhoneVerification.mockResolvedValue({
      data: { status: "VERIFIED", phoneNumber: "+2348012345678", verificationToken: "" },
    });

    await expect(
      runAction({
        intent: "check-phone",
        phoneNumber: "+2348012345678",
        code: "123456",
      }),
    ).resolves.toMatchObject({
      data: { phoneVerified: false, verificationToken: null },
    });

    checkGuestPhoneVerification.mockResolvedValue({
      data: { status: "VERIFIED", phoneNumber: "+2348012345678", verificationToken: 12 },
    });

    await expect(
      runAction({
        intent: "check-phone",
        phoneNumber: "+2348012345678",
        code: "123456",
      }),
    ).resolves.toMatchObject({
      data: { phoneVerified: false, verificationToken: null },
    });

    checkGuestPhoneVerification.mockResolvedValue({
      data: {
        status: "VERIFIED",
        phoneNumber: "+2348012345678",
        verificationToken: "proof-token",
      },
    });

    await expect(
      runAction({
        intent: "check-phone",
        phoneNumber: "+2348012345678",
        code: "123456",
      }),
    ).resolves.toMatchObject({
      data: { phoneVerified: true, verificationToken: "proof-token" },
    });
    expect(checkCurrentUserPhoneVerification).not.toHaveBeenCalled();
  });

  it("returns a field error for an invalid code", async () => {
    checkCurrentUserPhoneVerification.mockRejectedValue(
      apiError(
        HTTP_STATUS.UNPROCESSABLE_ENTITY,
        "That code is not valid.",
        "http",
        "PHONE_VERIFICATION_CODE_INVALID",
      ),
    );

    await expect(
      runAction({
        intent: "check-phone",
        phoneNumber: "+2348012345678",
        code: "123456",
        maskedPhoneNumber: "+234••••5678",
      }),
    ).resolves.toMatchObject({
      data: {
        intent: "check-phone",
        phoneVerified: false,
        maskedPhoneNumber: "+234••••5678",
        error: null,
        fieldErrors: { code: ["That code is not valid."] },
      },
      init: { status: HTTP_STATUS.UNPROCESSABLE_ENTITY },
    });
  });
});
