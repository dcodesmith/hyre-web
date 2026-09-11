import { RouterContextProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  acceptChauffeurConsent,
  checkChauffeurPhoneVerification,
  exchangeChauffeurInvitation,
  getChauffeurOnboarding,
  sendChauffeurPhoneVerification,
  verifyChauffeurDriving,
  verifyChauffeurNin,
} = vi.hoisted(() => ({
  acceptChauffeurConsent: vi.fn(),
  checkChauffeurPhoneVerification: vi.fn(),
  exchangeChauffeurInvitation: vi.fn(),
  getChauffeurOnboarding: vi.fn(),
  sendChauffeurPhoneVerification: vi.fn(),
  verifyChauffeurDriving: vi.fn(),
  verifyChauffeurNin: vi.fn(),
}));

const env = vi.hoisted(() => ({
  API_ORIGIN: "https://api.invalid",
  APP_ORIGIN: "http://localhost:5173",
  WEB_SESSION_SECRET: crypto.randomUUID(),
}));

vi.mock("cloudflare:workers", () => ({ env }));

vi.mock("~/api/chauffeurs/chauffeur-onboarding.server", () => ({
  acceptChauffeurConsent,
  checkChauffeurPhoneVerification,
  exchangeChauffeurInvitation,
  getChauffeurOnboarding,
  sendChauffeurPhoneVerification,
  verifyChauffeurDriving,
  verifyChauffeurNin,
}));

import { ApiRequestError } from "~/api/api.server";
import type { ChauffeurOnboarding } from "~/api/chauffeurs/schema";
import { HTTP_STATUS } from "~/api/http-status";
import {
  chauffeurOnboardingSetCookie,
  createChauffeurOnboardingSession,
} from "~/chauffeur/chauffeur-onboarding-session.server";
import type { Route } from "./+types/chauffeur.onboarding";
import { action, headers, loader, shouldRevalidate } from "./chauffeur.onboarding";

const IDEMPOTENCY_KEY = "18aa029c-4bb1-4ca7-b25e-cfc802c4bf8c";
const FRESH_IDEMPOTENCY_KEY = "9c4e2a71-6d3f-4b18-a5e2-7f1c0d8e4b92";
const INVITE_TOKEN = "e2e-chauffeur-invite-token-32chars!";
const SESSION_TOKEN = "chauffeur-session-token";
const SESSION_EXPIRES_AT = "2099-01-01T00:00:00.000Z";
const PHONE_NUMBER = "+2348012345678";
const PATH = "/chauffeur/onboarding";

const onboarding: ChauffeurOnboarding = {
  id: "chauffeur-1",
  name: "Bola Adebayo",
  email: "bola@example.com",
  phoneNumber: PHONE_NUMBER,
  fleetOwnerName: "Ada Lovelace",
  status: "INVITED",
  steps: { consent: false, phone: false, nin: false, driving: false },
  complianceRequirements: [],
};

function loaderArgs(request: Request): Route.LoaderArgs {
  return {
    request,
    url: new URL(request.url),
    pattern: PATH,
    params: {},
    context: new RouterContextProvider(),
  };
}

function actionArgs(request: Request): Route.ActionArgs {
  return {
    request,
    url: new URL(request.url),
    pattern: PATH,
    params: {},
    context: new RouterContextProvider(),
  };
}

function formData(fields: Record<string, File | string>) {
  const body = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    body.set(name, value);
  }
  return body;
}

function apiError(
  status: number,
  detail: string,
  retryAfter?: string,
  kind: ApiRequestError["kind"] = "http",
) {
  return new ApiRequestError(
    kind,
    status,
    {
      type: "CHAUFFEUR_ONBOARDING_ERROR",
      title: "Chauffeur onboarding error",
      status,
      detail,
    },
    retryAfter ? new Headers({ "Retry-After": retryAfter }) : undefined,
  );
}

function drivingFields(overrides: Record<string, File | string> = {}) {
  return {
    intent: "verify-driving",
    driversLicenseNumber: "ABC-12345",
    selfie: new File(["selfie"], "selfie.jpg", { type: "image/jpeg" }),
    idempotencyKey: IDEMPOTENCY_KEY,
    ...overrides,
  };
}

function hasResponseInit(result: unknown): result is { init: ResponseInit } {
  return (
    typeof result === "object" &&
    result !== null &&
    "init" in result &&
    typeof result.init === "object" &&
    result.init !== null
  );
}

function headersFromResult(result: unknown) {
  return hasResponseInit(result) ? new Headers(result.init.headers) : new Headers();
}

function expectRedirect(result: unknown, location: string): Response {
  expect(result).toBeInstanceOf(Response);
  if (!(result instanceof Response)) {
    throw new Error("Expected a redirect response");
  }
  expect(result.status).toBe(302);
  expect(result.headers.get("location")).toBe(location);
  return result;
}

async function sessionCookie(token = SESSION_TOKEN) {
  const session = createChauffeurOnboardingSession({
    token,
    expiresAt: SESSION_EXPIRES_AT,
  });
  return (await chauffeurOnboardingSetCookie(session)).split(";")[0] ?? "";
}

async function runAction(fields: Record<string, File | string>, cookie?: string) {
  const request = new Request(`https://tripdly.com${PATH}`, {
    method: "POST",
    headers: cookie ? { Cookie: cookie } : undefined,
    body: formData(fields),
  });
  const result = await action(actionArgs(request)).catch((error: unknown) => error);
  return { request, result };
}

describe("chauffeur onboarding route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getChauffeurOnboarding.mockResolvedValue({ data: onboarding });
    exchangeChauffeurInvitation.mockResolvedValue({
      data: {
        sessionToken: SESSION_TOKEN,
        sessionExpiresAt: SESSION_EXPIRES_AT,
        onboarding,
      },
    });
    acceptChauffeurConsent.mockResolvedValue({ data: onboarding });
    sendChauffeurPhoneVerification.mockResolvedValue({
      data: { status: "PENDING", phoneNumber: PHONE_NUMBER },
    });
    checkChauffeurPhoneVerification.mockResolvedValue({
      data: { status: "VERIFIED", phoneNumber: PHONE_NUMBER },
    });
    verifyChauffeurNin.mockResolvedValue({ data: onboarding });
    verifyChauffeurDriving.mockResolvedValue({ data: onboarding });
  });

  it("exchanges an invite token, then redirects to the clean URL with an encrypted HttpOnly cookie", async () => {
    const request = new Request(`https://tripdly.com${PATH}?token=${INVITE_TOKEN}`);
    const response = expectRedirect(
      await loader(loaderArgs(request)).catch((error: unknown) => error),
      PATH,
    );

    expect(exchangeChauffeurInvitation).toHaveBeenCalledWith({
      request,
      token: INVITE_TOKEN,
    });
    expect(getChauffeurOnboarding).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Path=/");
    expect(setCookie).not.toContain("Path=/chauffeur");
    expect(setCookie).not.toContain(SESSION_TOKEN);
    expect(setCookie).not.toContain(INVITE_TOKEN);
    expect(response.headers.get("location")).not.toContain("token=");
  });

  it("rejects a malformed invite token without calling the API", async () => {
    const response = expectRedirect(
      await loader(loaderArgs(new Request(`https://tripdly.com${PATH}?token=short`))).catch(
        (error: unknown) => error,
      ),
      PATH,
    );

    expect(exchangeChauffeurInvitation).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("removes a rejected invite token from the URL", async () => {
    exchangeChauffeurInvitation.mockRejectedValueOnce(
      apiError(HTTP_STATUS.NOT_FOUND, "Invitation is invalid"),
    );

    const response = expectRedirect(
      await loader(
        loaderArgs(new Request(`https://tripdly.com${PATH}?token=${INVITE_TOKEN}`)),
      ).catch((error: unknown) => error),
      PATH,
    );

    expect(response.headers.get("location")).not.toContain(INVITE_TOKEN);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("preserves a valid existing session when a reused invite token exchange fails", async () => {
    exchangeChauffeurInvitation.mockRejectedValueOnce(
      apiError(HTTP_STATUS.CONFLICT, "Invitation already used"),
    );
    const cookie = await sessionCookie();
    const request = new Request(`https://tripdly.com${PATH}?token=${INVITE_TOKEN}`, {
      headers: { Cookie: cookie },
    });

    const response = expectRedirect(
      await loader(loaderArgs(request)).catch((error: unknown) => error),
      PATH,
    );

    expect(exchangeChauffeurInvitation).toHaveBeenCalledWith({
      request,
      token: INVITE_TOKEN,
    });
    expect(getChauffeurOnboarding).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(PATH);
    expect(response.headers.get("location")).not.toContain("token=");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("clears the cookie when an invite token exchange fails without a session", async () => {
    exchangeChauffeurInvitation.mockRejectedValueOnce(
      apiError(HTTP_STATUS.NOT_FOUND, "Invitation is invalid"),
    );

    const response = expectRedirect(
      await loader(
        loaderArgs(new Request(`https://tripdly.com${PATH}?token=${INVITE_TOKEN}`)),
      ).catch((error: unknown) => error),
      PATH,
    );

    expect(exchangeChauffeurInvitation).toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(PATH);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("returns the unavailable state when the encrypted session is missing", async () => {
    const uuid = vi.spyOn(crypto, "randomUUID").mockReturnValue(IDEMPOTENCY_KEY);
    const result = await loader(loaderArgs(new Request(`https://tripdly.com${PATH}`)));

    expect(getChauffeurOnboarding).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      data: { onboarding: null, idempotencyKey: IDEMPOTENCY_KEY },
      init: { status: HTTP_STATUS.UNAUTHORIZED },
    });
    uuid.mockRestore();
  });

  it("loads onboarding with the bearer token from the encrypted session", async () => {
    const uuid = vi.spyOn(crypto, "randomUUID").mockReturnValue(IDEMPOTENCY_KEY);
    const cookie = await sessionCookie();
    const request = new Request(`https://tripdly.com${PATH}`, {
      headers: { Cookie: cookie },
    });

    const result = await loader(loaderArgs(request));

    expect(getChauffeurOnboarding).toHaveBeenCalledWith({
      request,
      sessionToken: SESSION_TOKEN,
    });
    expect(result).toEqual({
      onboarding,
      idempotencyKey: IDEMPOTENCY_KEY,
    });
    uuid.mockRestore();
  });

  it("clears an expired API session and returns the unavailable state", async () => {
    getChauffeurOnboarding.mockRejectedValueOnce(
      apiError(HTTP_STATUS.UNAUTHORIZED, "Unauthorized"),
    );
    const cookie = await sessionCookie();
    const result = await loader(
      loaderArgs(
        new Request(`https://tripdly.com${PATH}`, {
          headers: { Cookie: cookie },
        }),
      ),
    );

    expect(result).toMatchObject({
      data: { onboarding: null },
      init: { status: HTTP_STATUS.UNAUTHORIZED },
    });
    expect(headersFromResult(result).get("set-cookie")).toContain("Max-Age=0");
  });

  it("returns private no-store headers from the route", () => {
    expect(headers()).toEqual({
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    });
  });

  it("skips revalidation when an action asks to keep the current stage", () => {
    expect(
      shouldRevalidate({
        actionResult: { revalidate: false },
        defaultShouldRevalidate: true,
      } as Parameters<typeof shouldRevalidate>[0]),
    ).toBe(false);
    expect(
      shouldRevalidate({
        defaultShouldRevalidate: true,
      } as Parameters<typeof shouldRevalidate>[0]),
    ).toBe(true);
  });

  it("rejects staged actions without a session", async () => {
    const { result } = await runAction({ intent: "send-phone" });

    expect(sendChauffeurPhoneVerification).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      data: {
        intent: "send-phone",
        error: "This verification session has expired. Ask your fleet owner for a new invitation.",
        revalidate: false,
      },
      init: { status: HTTP_STATUS.UNAUTHORIZED },
    });
  });

  it("accepts consent through the mocked API adapter", async () => {
    const cookie = await sessionCookie();
    const { request, result } = await runAction(
      { intent: "accept-consent", termsAccepted: "on", privacyAccepted: "on" },
      cookie,
    );

    expect(acceptChauffeurConsent).toHaveBeenCalledWith({
      request,
      sessionToken: SESSION_TOKEN,
    });
    expect(result).toMatchObject({ data: { intent: "accept-consent" } });
  });

  it("returns consent field errors without calling the API", async () => {
    const { result } = await runAction({ intent: "accept-consent" }, await sessionCookie());

    expect(acceptChauffeurConsent).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      data: {
        intent: "accept-consent",
        revalidate: false,
        submission: expect.objectContaining({
          error: expect.objectContaining({
            termsAccepted: ["Accept the terms to continue"],
          }),
        }),
      },
      init: { status: HTTP_STATUS.BAD_REQUEST },
    });
  });

  it("sends a phone code and keeps the notice on the current stage", async () => {
    const cookie = await sessionCookie();
    const { request, result } = await runAction({ intent: "send-phone" }, cookie);

    expect(sendChauffeurPhoneVerification).toHaveBeenCalledWith({
      request,
      sessionToken: SESSION_TOKEN,
    });
    expect(result).toMatchObject({
      data: {
        intent: "send-phone",
        notice: `Code sent to ${PHONE_NUMBER}`,
        revalidate: false,
      },
    });
  });

  it("checks the phone code through the mocked API adapter", async () => {
    const cookie = await sessionCookie();
    const { request, result } = await runAction({ intent: "check-phone", code: "123456" }, cookie);

    expect(checkChauffeurPhoneVerification).toHaveBeenCalledWith({
      request,
      sessionToken: SESSION_TOKEN,
      code: "123456",
    });
    expect(result).toMatchObject({ data: { intent: "check-phone" } });
  });

  it("keeps the NIN idempotency key after local validation errors", async () => {
    const invalid = await runAction(
      { intent: "verify-nin", nin: "123", idempotencyKey: IDEMPOTENCY_KEY },
      await sessionCookie(),
    );

    expect(verifyChauffeurNin).not.toHaveBeenCalled();
    expect(invalid.result).toMatchObject({
      data: { intent: "verify-nin", idempotencyKey: IDEMPOTENCY_KEY, revalidate: false },
      init: { status: HTTP_STATUS.BAD_REQUEST },
    });
  });

  it("issues a fresh NIN idempotency key after a definitive HTTP error", async () => {
    verifyChauffeurNin.mockRejectedValueOnce(apiError(HTTP_STATUS.CONFLICT, "NIN already used."));
    const uuid = vi.spyOn(crypto, "randomUUID").mockReturnValue(FRESH_IDEMPOTENCY_KEY);

    try {
      const { result } = await runAction(
        { intent: "verify-nin", nin: "12345678901", idempotencyKey: IDEMPOTENCY_KEY },
        await sessionCookie(),
      );

      expect(result).toMatchObject({
        data: {
          intent: "verify-nin",
          error: "NIN already used.",
          idempotencyKey: FRESH_IDEMPOTENCY_KEY,
          revalidate: false,
        },
        init: { status: HTTP_STATUS.CONFLICT },
      });
      expect(uuid).toHaveBeenCalledOnce();
    } finally {
      uuid.mockRestore();
    }
  });

  it.each([
    ["network", HTTP_STATUS.SERVICE_UNAVAILABLE],
    ["timeout", HTTP_STATUS.GATEWAY_TIMEOUT],
  ] as const)("keeps the NIN idempotency key after a %s error", async (kind, status) => {
    verifyChauffeurNin.mockRejectedValueOnce(
      apiError(status, "upstream unavailable", undefined, kind),
    );
    const uuid = vi.spyOn(crypto, "randomUUID").mockReturnValue(FRESH_IDEMPOTENCY_KEY);

    try {
      const { result } = await runAction(
        { intent: "verify-nin", nin: "12345678901", idempotencyKey: IDEMPOTENCY_KEY },
        await sessionCookie(),
      );

      expect(result).toMatchObject({
        data: {
          intent: "verify-nin",
          error: "Unable to verify your NIN. Please try again.",
          idempotencyKey: IDEMPOTENCY_KEY,
          revalidate: false,
        },
        init: { status },
      });
      expect(uuid).not.toHaveBeenCalled();
    } finally {
      uuid.mockRestore();
    }
  });

  it("verifies NIN with the bearer session and the submitted idempotency key", async () => {
    const cookie = await sessionCookie();
    const { request, result } = await runAction(
      { intent: "verify-nin", nin: "12345678901", idempotencyKey: IDEMPOTENCY_KEY },
      cookie,
    );

    expect(verifyChauffeurNin).toHaveBeenCalledWith({
      request,
      sessionToken: SESSION_TOKEN,
      idempotencyKey: IDEMPOTENCY_KEY,
      nin: "12345678901",
    });
    expect(result).toMatchObject({ data: { intent: "verify-nin" } });
  });

  it("verifies driving credentials as multipart without forwarding the form intent", async () => {
    const selfie = new File(["selfie"], "selfie.jpg", { type: "image/jpeg" });
    const cookie = await sessionCookie();
    const { request, result } = await runAction(
      {
        intent: "verify-driving",
        driversLicenseNumber: "ABC-12345",
        selfie,
        idempotencyKey: IDEMPOTENCY_KEY,
      },
      cookie,
    );

    expect(verifyChauffeurDriving).toHaveBeenCalledWith({
      request,
      sessionToken: SESSION_TOKEN,
      idempotencyKey: IDEMPOTENCY_KEY,
      formData: expect.any(FormData),
    });
    const sent = verifyChauffeurDriving.mock.calls[0]?.[0]?.formData;
    if (!(sent instanceof FormData)) {
      throw new Error("expected FormData");
    }
    expect(sent.get("driversLicenseNumber")).toBe("ABC-12345");
    const sentSelfie = sent.get("selfie");
    expect(sentSelfie).toBeInstanceOf(File);
    if (!(sentSelfie instanceof File)) {
      throw new Error("expected selfie File");
    }
    expect(sentSelfie.name).toBe("selfie.jpg");
    expect(sentSelfie.type).toBe("image/jpeg");
    expect(sent.get("intent")).toBeNull();
    expect(sent.get("idempotencyKey")).toBeNull();
    expect(result).toMatchObject({ data: { intent: "verify-driving" } });
  });

  it("hides 5xx details and issues a fresh NIN idempotency key", async () => {
    verifyChauffeurNin.mockRejectedValueOnce(
      apiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, "database exploded"),
    );
    const uuid = vi.spyOn(crypto, "randomUUID").mockReturnValue(FRESH_IDEMPOTENCY_KEY);

    try {
      const { result } = await runAction(
        { intent: "verify-nin", nin: "12345678901", idempotencyKey: IDEMPOTENCY_KEY },
        await sessionCookie(),
      );

      expect(result).toMatchObject({
        data: {
          intent: "verify-nin",
          error: "Unable to verify your NIN. Please try again.",
          idempotencyKey: FRESH_IDEMPOTENCY_KEY,
          revalidate: false,
        },
        init: { status: HTTP_STATUS.INTERNAL_SERVER_ERROR },
      });
      expect(JSON.stringify(result)).not.toContain("database exploded");
      expect(uuid).toHaveBeenCalledOnce();
    } finally {
      uuid.mockRestore();
    }
  });

  it("keeps the driving idempotency key after local validation errors", async () => {
    const { result } = await runAction(
      drivingFields({ driversLicenseNumber: "ab" }),
      await sessionCookie(),
    );

    expect(verifyChauffeurDriving).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      data: { intent: "verify-driving", idempotencyKey: IDEMPOTENCY_KEY, revalidate: false },
      init: { status: HTTP_STATUS.BAD_REQUEST },
    });
  });

  it("issues a fresh driving idempotency key after a definitive HTTP error", async () => {
    verifyChauffeurDriving.mockRejectedValueOnce(
      apiError(HTTP_STATUS.UNPROCESSABLE_ENTITY, "Licence could not be verified."),
    );
    const uuid = vi.spyOn(crypto, "randomUUID").mockReturnValue(FRESH_IDEMPOTENCY_KEY);

    try {
      const { result } = await runAction(drivingFields(), await sessionCookie());

      expect(result).toMatchObject({
        data: {
          intent: "verify-driving",
          error: "Licence could not be verified.",
          idempotencyKey: FRESH_IDEMPOTENCY_KEY,
          revalidate: false,
        },
        init: { status: HTTP_STATUS.UNPROCESSABLE_ENTITY },
      });
      expect(uuid).toHaveBeenCalledOnce();
    } finally {
      uuid.mockRestore();
    }
  });

  it.each([
    ["network", HTTP_STATUS.SERVICE_UNAVAILABLE],
    ["timeout", HTTP_STATUS.GATEWAY_TIMEOUT],
  ] as const)("keeps the driving idempotency key after a %s error", async (kind, status) => {
    verifyChauffeurDriving.mockRejectedValueOnce(
      apiError(status, "upstream unavailable", undefined, kind),
    );
    const uuid = vi.spyOn(crypto, "randomUUID").mockReturnValue(FRESH_IDEMPOTENCY_KEY);

    try {
      const { result } = await runAction(drivingFields(), await sessionCookie());

      expect(result).toMatchObject({
        data: {
          intent: "verify-driving",
          error: "Unable to complete driving verification. Please try again.",
          idempotencyKey: IDEMPOTENCY_KEY,
          revalidate: false,
        },
        init: { status },
      });
      expect(uuid).not.toHaveBeenCalled();
    } finally {
      uuid.mockRestore();
    }
  });

  it("keeps the driving idempotency key after an API error with Retry-After", async () => {
    verifyChauffeurDriving.mockRejectedValueOnce(
      apiError(HTTP_STATUS.TOO_MANY_REQUESTS, "Try again later.", "30"),
    );
    const uuid = vi.spyOn(crypto, "randomUUID").mockReturnValue(FRESH_IDEMPOTENCY_KEY);

    try {
      const { result } = await runAction(drivingFields(), await sessionCookie());

      expect(result).toMatchObject({
        data: {
          intent: "verify-driving",
          error: "Try again later.",
          idempotencyKey: IDEMPOTENCY_KEY,
          revalidate: false,
        },
        init: { status: HTTP_STATUS.TOO_MANY_REQUESTS },
      });
      expect(headersFromResult(result).get("Retry-After")).toBe("30");
      expect(uuid).not.toHaveBeenCalled();
    } finally {
      uuid.mockRestore();
    }
  });
});
