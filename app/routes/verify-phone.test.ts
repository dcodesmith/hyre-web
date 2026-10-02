import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  checkCurrentUserPhoneVerification,
  getCurrentUserProfile,
  sendCurrentUserPhoneVerification,
} = vi.hoisted(() => ({
  checkCurrentUserPhoneVerification: vi.fn(),
  getCurrentUserProfile: vi.fn(),
  sendCurrentUserPhoneVerification: vi.fn(),
}));

vi.mock("~/api/users/users.server", () => ({
  checkCurrentUserPhoneVerification,
  getCurrentUserProfile,
  sendCurrentUserPhoneVerification,
}));

import { ApiRequestError } from "~/api/api.server";
import { HTTP_STATUS } from "~/api/http-status";
import { action, loader } from "./verify-phone";

const SESSION = "better-auth.session_token=session-1";
const PHONE = "+2348012345678";
const MASKED = "+234******5678";

function profile(phoneVerified: boolean, phoneNumber: string | null = PHONE) {
  return {
    data: {
      name: "Ada Lovelace",
      phoneNumber,
      phoneVerified,
      city: null,
      address: null,
      marketingConsent: false,
    },
  };
}

function routeArgs(request: Request) {
  return { request, params: {}, context: {} } as never;
}

function request(path: string, init?: RequestInit) {
  return new Request(`https://tripdly.com${path}`, init);
}

async function thrown(work: Promise<unknown>) {
  try {
    return await work;
  } catch (error) {
    return error;
  }
}

function locationOf(result: unknown) {
  expect(result).toBeInstanceOf(Response);
  return new URL((result as Response).headers.get("location") ?? "", "https://tripdly.com");
}

function httpError(status: number, detail: string, errorCode?: string) {
  return new ApiRequestError("http", status, {
    type: errorCode ?? "PHONE_VERIFICATION_ERROR",
    title: "Phone verification error",
    status,
    detail,
    ...(errorCode ? { errorCode } : {}),
  });
}

describe("verify-phone loader", () => {
  beforeEach(() => {
    getCurrentUserProfile.mockReset();
  });

  it("sends a missing session to login and keeps a safe redirect", async () => {
    const safe = locationOf(
      await thrown(loader(routeArgs(request("/verify-phone?redirectTo=%2Fprofile")))),
    );
    expect(safe.pathname).toBe("/auth");
    expect(safe.searchParams.get("redirectTo")).toBe("/profile");
    expect(
      ((await thrown(loader(routeArgs(request("/verify-phone"))))) as Response).headers.get(
        "Cache-Control",
      ),
    ).toBe("private, no-store");

    const unsafe = locationOf(
      await thrown(loader(routeArgs(request("/verify-phone?redirectTo=%2F%2Fevil.example")))),
    );
    expect(unsafe.pathname).toBe("/auth");
    expect(unsafe.searchParams.get("redirectTo")).toBeNull();
    expect(getCurrentUserProfile).not.toHaveBeenCalled();
  });

  it("returns a change-phone login to the verification URL", async () => {
    const location = locationOf(
      await thrown(loader(routeArgs(request("/verify-phone?redirectTo=%2Fprofile&change=phone")))),
    );

    expect(location.pathname).toBe("/auth");
    expect(location.searchParams.get("redirectTo")).toBe(
      "/verify-phone?redirectTo=%2Fprofile&change=phone",
    );
  });

  it("bypasses a verified phone and allows an explicit change", async () => {
    getCurrentUserProfile.mockResolvedValue(profile(true));

    const bypass = locationOf(
      await thrown(
        loader(
          routeArgs(
            request("/verify-phone?redirectTo=%2Fbookings%2Fbooking-1", {
              headers: { Cookie: SESSION },
            }),
          ),
        ),
      ),
    );
    expect(bypass.pathname).toBe("/bookings/booking-1");

    const unsafe = locationOf(
      await thrown(
        loader(
          routeArgs(
            request("/verify-phone?redirectTo=https%3A%2F%2Fevil.example", {
              headers: { Cookie: SESSION },
            }),
          ),
        ),
      ),
    );
    expect(`${unsafe.pathname}${unsafe.search}`).toBe("/");

    getCurrentUserProfile.mockResolvedValue(profile(true));
    await expect(
      loader(
        routeArgs(
          request("/verify-phone?redirectTo=%2Fprofile&change=phone", {
            headers: { Cookie: SESSION },
          }),
        ),
      ),
    ).resolves.toEqual({ changingPhone: true, initialPhoneNumber: PHONE });
  });

  it("keeps an unverified session on the phone step", async () => {
    getCurrentUserProfile.mockResolvedValue(profile(false, null));

    await expect(
      loader(
        routeArgs(
          request("/verify-phone?change=phone", {
            headers: { Cookie: SESSION },
          }),
        ),
      ),
    ).resolves.toEqual({ changingPhone: false, initialPhoneNumber: undefined });
  });

  it("sends an unauthorized profile lookup back to login", async () => {
    getCurrentUserProfile.mockRejectedValue(httpError(HTTP_STATUS.UNAUTHORIZED, "Sign in again."));

    const location = locationOf(
      await thrown(
        loader(
          routeArgs(
            request("/verify-phone?redirectTo=%2Fprofile", { headers: { Cookie: SESSION } }),
          ),
        ),
      ),
    );

    expect(location.pathname).toBe("/auth");
    expect(location.searchParams.get("redirectTo")).toBe("/profile");
  });

  it("does not hide other profile lookup failures", async () => {
    const error = new Error("API unavailable");
    getCurrentUserProfile.mockRejectedValue(error);

    await expect(
      loader(routeArgs(request("/verify-phone", { headers: { Cookie: SESSION } }))),
    ).rejects.toBe(error);
  });
});

describe("verify-phone action", () => {
  beforeEach(() => {
    sendCurrentUserPhoneVerification.mockReset();
    checkCurrentUserPhoneVerification.mockReset();
    sendCurrentUserPhoneVerification.mockResolvedValue({
      data: { status: "PENDING", phoneNumber: MASKED },
    });
    checkCurrentUserPhoneVerification.mockResolvedValue({
      data: { status: "VERIFIED", phoneNumber: PHONE },
    });
  });

  it("sends a missing session to login before reading the form", async () => {
    const location = locationOf(
      await thrown(
        action(
          routeArgs(
            request("/verify-phone?redirectTo=%2Fprofile", {
              method: "POST",
              body: new URLSearchParams({ intent: "send-phone", phoneNumber: PHONE }),
            }),
          ),
        ),
      ),
    );

    expect(location.pathname).toBe("/auth");
    expect(location.searchParams.get("redirectTo")).toBe("/profile");
    expect(sendCurrentUserPhoneVerification).not.toHaveBeenCalled();
  });

  it("rejects an unknown intent", async () => {
    await expect(
      action(
        routeArgs(
          request("/verify-phone", {
            method: "POST",
            headers: { Cookie: SESSION },
            body: new URLSearchParams({ intent: "delete-phone" }),
          }),
        ),
      ),
    ).rejects.toMatchObject({
      data: null,
      init: { status: HTTP_STATUS.BAD_REQUEST },
    });
    expect(sendCurrentUserPhoneVerification).not.toHaveBeenCalled();
  });

  it("sends a code and keeps the masked number for resend", async () => {
    const requestUrl = request("/verify-phone?redirectTo=%2Fprofile", {
      method: "POST",
      headers: { Cookie: SESSION },
      body: new URLSearchParams({
        intent: "send-phone",
        phoneNumber: ` ${PHONE} `,
        maskedPhoneNumber: MASKED,
      }),
    });

    const result = await action(routeArgs(requestUrl));

    expect(sendCurrentUserPhoneVerification).toHaveBeenCalledWith({
      request: requestUrl,
      phoneNumber: PHONE,
    });
    expect(result).toMatchObject({
      data: {
        intent: "send-phone",
        maskedPhoneNumber: MASKED,
        notice: `Code sent to ${MASKED}.`,
        phoneNumber: PHONE,
      },
    });
  });

  it("checks a code and completes on the safe redirect", async () => {
    const result = await thrown(
      action(
        routeArgs(
          request("/verify-phone?redirectTo=%2Fbookings%2Fbooking-1", {
            method: "POST",
            headers: { Cookie: SESSION },
            body: new URLSearchParams({
              intent: "check-phone",
              phoneNumber: PHONE,
              code: "123456",
              maskedPhoneNumber: MASKED,
            }),
          }),
        ),
      ),
    );

    expect(checkCurrentUserPhoneVerification).toHaveBeenCalledWith(
      expect.objectContaining({ phoneNumber: PHONE, code: "123456" }),
    );
    const location = locationOf(result);
    expect(location.pathname).toBe("/bookings/booking-1");
    expect((result as Response).headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("completes immediately when sending reports the number is already verified", async () => {
    sendCurrentUserPhoneVerification.mockResolvedValue({
      data: { status: "VERIFIED", phoneNumber: PHONE },
    });

    const location = locationOf(
      await thrown(
        action(
          routeArgs(
            request("/verify-phone?redirectTo=%2F%2Fevil.example", {
              method: "POST",
              headers: { Cookie: SESSION },
              body: new URLSearchParams({ intent: "send-phone", phoneNumber: PHONE }),
            }),
          ),
        ),
      ),
    );

    expect(`${location.pathname}${location.search}`).toBe("/");
  });

  it("keeps a still-pending check on the code step", async () => {
    checkCurrentUserPhoneVerification.mockResolvedValue({
      data: { status: "PENDING", phoneNumber: MASKED },
    });

    const result = await action(
      routeArgs(
        request("/verify-phone", {
          method: "POST",
          headers: { Cookie: SESSION },
          body: new URLSearchParams({
            intent: "check-phone",
            phoneNumber: PHONE,
            code: "1234",
          }),
        }),
      ),
    );

    expect(result).toMatchObject({
      data: {
        intent: "check-phone",
        maskedPhoneNumber: MASKED,
        notice: `Verification is still pending for ${MASKED}.`,
        phoneNumber: PHONE,
      },
    });
  });

  it("returns field errors for an invalid number or code without calling the API", async () => {
    const phone = await action(
      routeArgs(
        request("/verify-phone", {
          method: "POST",
          headers: { Cookie: SESSION },
          body: new URLSearchParams({ intent: "send-phone", phoneNumber: "08012345678" }),
        }),
      ),
    );
    expect(phone).toMatchObject({
      data: {
        intent: "send-phone",
        submission: expect.objectContaining({
          error: { phoneNumber: ["Enter a phone number in international format"] },
        }),
      },
      init: { status: HTTP_STATUS.BAD_REQUEST },
    });

    const code = await action(
      routeArgs(
        request("/verify-phone", {
          method: "POST",
          headers: { Cookie: SESSION },
          body: new URLSearchParams({
            intent: "check-phone",
            phoneNumber: PHONE,
            code: "12",
            maskedPhoneNumber: MASKED,
          }),
        }),
      ),
    );
    expect(code).toMatchObject({
      data: {
        intent: "check-phone",
        maskedPhoneNumber: MASKED,
        phoneNumber: PHONE,
        submission: expect.objectContaining({
          error: { code: ["Enter the verification code"] },
        }),
      },
      init: { status: HTTP_STATUS.BAD_REQUEST },
    });
    expect(sendCurrentUserPhoneVerification).not.toHaveBeenCalled();
    expect(checkCurrentUserPhoneVerification).not.toHaveBeenCalled();
  });

  it("puts an invalid verification code on the code field", async () => {
    checkCurrentUserPhoneVerification.mockRejectedValue(
      httpError(
        HTTP_STATUS.UNPROCESSABLE_ENTITY,
        "That code is invalid or expired.",
        "PHONE_VERIFICATION_CODE_INVALID",
      ),
    );

    const result = await action(
      routeArgs(
        request("/verify-phone", {
          method: "POST",
          headers: { Cookie: SESSION },
          body: new URLSearchParams({
            intent: "check-phone",
            phoneNumber: PHONE,
            code: "123456",
            maskedPhoneNumber: MASKED,
          }),
        }),
      ),
    );

    expect(result).toMatchObject({
      data: {
        intent: "check-phone",
        maskedPhoneNumber: MASKED,
        phoneNumber: PHONE,
        submission: expect.objectContaining({
          error: { code: ["That code is invalid or expired."] },
        }),
      },
      init: { status: HTTP_STATUS.UNPROCESSABLE_ENTITY },
    });
  });

  it("sends an unauthorized verification call back to login", async () => {
    sendCurrentUserPhoneVerification.mockRejectedValue(
      httpError(HTTP_STATUS.UNAUTHORIZED, "Sign in again."),
    );

    const location = locationOf(
      await thrown(
        action(
          routeArgs(
            request("/verify-phone?redirectTo=%2Fprofile&change=phone", {
              method: "POST",
              headers: { Cookie: SESSION },
              body: new URLSearchParams({ intent: "send-phone", phoneNumber: PHONE }),
            }),
          ),
        ),
      ),
    );

    expect(location.pathname).toBe("/auth");
    expect(location.searchParams.get("redirectTo")).toBe(
      "/verify-phone?redirectTo=%2Fprofile&change=phone",
    );
  });

  it("hides upstream failures and rethrows an aborted request", async () => {
    sendCurrentUserPhoneVerification.mockRejectedValueOnce(
      httpError(HTTP_STATUS.INTERNAL_SERVER_ERROR, "database password"),
    );

    const failed = await action(
      routeArgs(
        request("/verify-phone", {
          method: "POST",
          headers: { Cookie: SESSION },
          body: new URLSearchParams({ intent: "send-phone", phoneNumber: PHONE }),
        }),
      ),
    );
    expect(failed).toMatchObject({
      data: {
        submission: expect.objectContaining({
          error: { "": ["Unable to verify your phone. Please try again."] },
        }),
      },
      init: { status: HTTP_STATUS.INTERNAL_SERVER_ERROR },
    });
    expect(JSON.stringify(failed)).not.toContain("database password");

    const aborted = new ApiRequestError("aborted", HTTP_STATUS.CLIENT_CLOSED_REQUEST, {
      type: "REQUEST_ABORTED",
      title: "Request aborted",
      status: HTTP_STATUS.CLIENT_CLOSED_REQUEST,
      detail: "The request was cancelled before the upstream API responded.",
    });
    checkCurrentUserPhoneVerification.mockRejectedValueOnce(aborted);
    await expect(
      action(
        routeArgs(
          request("/verify-phone", {
            method: "POST",
            headers: { Cookie: SESSION },
            body: new URLSearchParams({
              intent: "check-phone",
              phoneNumber: PHONE,
              code: "123456",
            }),
          }),
        ),
      ),
    ).rejects.toBe(aborted);
  });
});
