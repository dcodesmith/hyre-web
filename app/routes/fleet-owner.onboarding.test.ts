import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const {
  checkFleetOwnerPhoneVerification,
  createFleetOwnerAccountVerification,
  getFleetOwnerBanks,
  replaceFleetOwnerDriverLicense,
  sendFleetOwnerPhoneVerification,
} = vi.hoisted(() => ({
  checkFleetOwnerPhoneVerification: vi.fn(),
  createFleetOwnerAccountVerification: vi.fn(),
  getFleetOwnerBanks: vi.fn(),
  replaceFleetOwnerDriverLicense: vi.fn(),
  sendFleetOwnerPhoneVerification: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({
  env: { API_ORIGIN: "https://api.invalid" },
}));

vi.mock("~/api/fleet/onboarding/onboarding.server", () => ({
  checkFleetOwnerPhoneVerification,
  createFleetOwnerAccountVerification,
  getFleetOwnerBanks,
  replaceFleetOwnerDriverLicense,
  sendFleetOwnerPhoneVerification,
}));

import { ApiRequestError } from "~/api/api.server";
import type { FleetOwnerOnboarding } from "~/api/fleet/onboarding/schema";
import { HTTP_STATUS } from "~/api/http-status";
import {
  onboardingAccountFormSchema,
  onboardingPhoneCheckFormSchema,
  onboardingPhoneFormSchema,
} from "~/fleet/onboarding/onboarding-form-schema";
import { action, loader } from "./fleet-owner.onboarding";

const BANKS = [
  { code: "044", name: "Access Bank" },
  { code: "058", name: "GTBank" },
];
const IDEMPOTENCY_KEY = "18aa029c-4bb1-4ca7-b25e-cfc802c4bf8c";
const PHONE_NUMBER = "+2348012345678";
const ONBOARDING_RETRY = "Unable to complete this onboarding step. Please try again.";
const OWNER_USER = {
  id: "owner-1",
  email: "owner@example.com",
  name: "Fleet Owner",
  roles: ["fleetOwner"],
};

function firstIssue(schema: z.ZodType, value: unknown) {
  const parsed = schema.safeParse(value);
  if (parsed.success) {
    throw new Error("expected invalid input");
  }
  return parsed.error.issues[0]?.message ?? "";
}

const INVALID_PHONE_MESSAGE = firstIssue(onboardingPhoneFormSchema, {
  phoneNumber: "08012345678",
});
const INVALID_OTP_MESSAGE = firstIssue(onboardingPhoneCheckFormSchema, {
  phoneNumber: PHONE_NUMBER,
  code: "12",
});
const INVALID_NIN_MESSAGE = firstIssue(onboardingAccountFormSchema, {
  accountType: "INDIVIDUAL",
  nin: "123",
  isOwnerDriver: "false",
  bankName: "GTBank",
  bankCode: "058",
  accountNumber: "0123456789",
});
const INVALID_UUID_MESSAGE = firstIssue(z.uuid(), "not-a-uuid");
const SELECT_BANK_MESSAGE = firstIssue(onboardingAccountFormSchema, {
  accountType: "INDIVIDUAL",
  nin: "12345678901",
  isOwnerDriver: "false",
  bankName: "GTBank",
  bankCode: "",
  accountNumber: "0123456789",
});
const INVALID_LICENSE_FILE = new File([new Uint8Array(32)], "license.gif", { type: "image/gif" });
const INVALID_LICENSE_MESSAGE = firstIssue(onboardingAccountFormSchema, {
  accountType: "INDIVIDUAL",
  nin: "12345678901",
  isOwnerDriver: "true",
  bankName: "GTBank",
  bankCode: "058",
  accountNumber: "0123456789",
  driversLicense: INVALID_LICENSE_FILE,
});
const VALID_LICENSE_FILE = new File(["%PDF-1.4 licence"], "license.pdf", {
  type: "application/pdf",
});

function parentOnboarding(overrides: Partial<FleetOwnerOnboarding> = {}): FleetOwnerOnboarding {
  return {
    status: "ACTION_REQUIRED",
    accountType: null,
    isOwnerDriver: false,
    emailVerified: true,
    phone: { number: PHONE_NUMBER, verified: true },
    identity: null,
    bank: null,
    documents: { driversLicense: null, lasdri: null },
    requiredActions: [],
    ...overrides,
  };
}

function loaderArgs(onboarding: FleetOwnerOnboarding) {
  const request = new Request("https://tripdly.com/fleet-owner/onboarding");
  const get = vi.fn(() => ({ user: OWNER_USER, onboarding }));
  return {
    request,
    get,
    args: {
      request,
      params: {},
      context: { get },
    } as never,
  };
}

function actionData(result: unknown) {
  return (result as { data: Record<string, unknown> }).data;
}

const validAccountFields = {
  intent: "verify-account",
  idempotencyKey: IDEMPOTENCY_KEY,
  accountType: "INDIVIDUAL",
  nin: "12345678901",
  isOwnerDriver: "false",
  bankName: "Evil Bank",
  bankCode: "058",
  accountNumber: "0123456789",
} as const;

function apiError(status: number, detail: string, kind: "http" | "network" = "http") {
  return new ApiRequestError(kind, status, {
    type: "FLEET_OWNER_ONBOARDING_ERROR",
    title: "Onboarding error",
    status,
    detail,
  });
}

function formData(fields: Record<string, File | string>) {
  const body = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    body.set(name, value);
  }
  return body;
}

function actionArgs(fields: Record<string, File | string>) {
  const request = new Request("https://tripdly.com/fleet-owner/onboarding", {
    method: "POST",
    body: formData(fields),
  });
  return { request, args: { request, params: {}, context: {} } as never };
}

async function runAction(fields: Record<string, File | string>) {
  const { request, args } = actionArgs(fields);
  const result = await action(args).catch((error: unknown) => error);
  return { request, result };
}

function expectRedirect(result: unknown, location: string) {
  expect(result).toBeInstanceOf(Response);
  expect((result as Response).status).toBe(302);
  expect((result as Response).headers.get("location")).toBe(location);
}

describe("fleet-owner onboarding route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getFleetOwnerBanks.mockResolvedValue({ data: BANKS });
    sendFleetOwnerPhoneVerification.mockResolvedValue({
      data: { status: "PENDING", phoneNumber: PHONE_NUMBER },
    });
    checkFleetOwnerPhoneVerification.mockResolvedValue({
      data: { status: "VERIFIED", phoneNumber: PHONE_NUMBER },
    });
    createFleetOwnerAccountVerification.mockResolvedValue({
      data: { id: "ver-1", status: "SUCCEEDED" },
    });
    replaceFleetOwnerDriverLicense.mockResolvedValue({
      data: { status: "PENDING" },
    });
  });

  it("loads banks from the parent FleetOwner context when email and phone are verified", async () => {
    const uuid = vi.spyOn(crypto, "randomUUID").mockReturnValue(IDEMPOTENCY_KEY);
    const { request, args, get } = loaderArgs(parentOnboarding());

    const result = await loader(args);

    expect(get).toHaveBeenCalled();
    expect(getFleetOwnerBanks).toHaveBeenCalledWith({ request });
    expect(result).toEqual({ banks: BANKS, idempotencyKey: IDEMPOTENCY_KEY });
    uuid.mockRestore();
  });

  it.each([
    [
      "unverified email",
      parentOnboarding({
        emailVerified: false,
        phone: { number: PHONE_NUMBER, verified: true },
      }),
    ],
    [
      "unverified phone",
      parentOnboarding({
        emailVerified: true,
        phone: { number: null, verified: false },
      }),
    ],
    [
      "under review",
      parentOnboarding({
        status: "UNDER_REVIEW",
        emailVerified: true,
        phone: { number: PHONE_NUMBER, verified: true },
      }),
    ],
  ] as const)("returns no banks during %s", async (_label, onboarding) => {
    const uuid = vi.spyOn(crypto, "randomUUID").mockReturnValue(IDEMPOTENCY_KEY);
    const { args, get } = loaderArgs(onboarding);

    const result = await loader(args);

    expect(get).toHaveBeenCalled();
    expect(getFleetOwnerBanks).not.toHaveBeenCalled();
    expect(result).toEqual({ banks: [], idempotencyKey: IDEMPOTENCY_KEY });
    uuid.mockRestore();
  });

  it("sends an E.164 phone verification", async () => {
    const { request, result } = await runAction({
      intent: "send-phone",
      phoneNumber: PHONE_NUMBER,
    });

    expect(sendFleetOwnerPhoneVerification).toHaveBeenCalledWith({
      request,
      body: { phoneNumber: PHONE_NUMBER },
    });
    expect(result).not.toMatchObject({ init: { status: HTTP_STATUS.BAD_REQUEST } });
  });

  it("checks the phone code and redirects to onboarding", async () => {
    const { request, result } = await runAction({
      intent: "check-phone",
      phoneNumber: PHONE_NUMBER,
      code: "123456",
    });

    expect(checkFleetOwnerPhoneVerification).toHaveBeenCalledWith({
      request,
      body: { phoneNumber: PHONE_NUMBER, code: "123456" },
    });
    expectRedirect(result, "/fleet-owner/onboarding");
  });

  it("verifies the account with a derived bank name and sanitized multipart", async () => {
    const driversLicense = new File(["%PDF-1.4 licence"], "license.pdf", {
      type: "application/pdf",
    });
    const lasdri = new File(["lasdri"], "lasdri.jpg", { type: "image/jpeg" });
    const { request, result } = await runAction({
      ...validAccountFields,
      isOwnerDriver: "true",
      extra: "drop-me",
      driversLicense,
      lasdri,
    });

    expect(getFleetOwnerBanks).toHaveBeenCalledWith({ request });
    expect(createFleetOwnerAccountVerification).toHaveBeenCalledWith({
      request,
      idempotencyKey: IDEMPOTENCY_KEY,
      formData: expect.any(FormData),
    });
    const sent = createFleetOwnerAccountVerification.mock.calls[0][0].formData as FormData;
    expect(sent.get("bankName")).toBe("GTBank");
    expect(sent.get("bankCode")).toBe("058");
    expect(sent.get("accountType")).toBe("INDIVIDUAL");
    expect(sent.get("nin")).toBe("12345678901");
    expect(sent.get("accountNumber")).toBe("0123456789");
    expect(String(sent.get("isOwnerDriver"))).toBe("true");
    expect((sent.get("driversLicense") as File).name).toBe("license.pdf");
    expect((sent.get("lasdri") as File).name).toBe("lasdri.jpg");
    expect(sent.get("intent")).toBeNull();
    expect(sent.get("idempotencyKey")).toBeNull();
    expect(sent.get("extra")).toBeNull();
    expectRedirect(result, "/fleet-owner/onboarding");
  });

  it("replaces a driver licence and redirects to onboarding", async () => {
    const { request, result } = await runAction({
      intent: "replace-driver-license",
      file: VALID_LICENSE_FILE,
    });

    expect(replaceFleetOwnerDriverLicense).toHaveBeenCalledWith({
      request,
      file: expect.any(File),
    });
    const sent = replaceFleetOwnerDriverLicense.mock.calls[0][0].file as File;
    expect(sent.name).toBe("license.pdf");
    expect(sent.type).toBe("application/pdf");
    expectRedirect(result, "/fleet-owner/onboarding");
  });

  it.each([
    [
      "send-phone",
      { intent: "send-phone", phoneNumber: "08012345678" },
      sendFleetOwnerPhoneVerification,
      { error: INVALID_PHONE_MESSAGE, revalidate: false },
    ],
    [
      "check-phone",
      { intent: "check-phone", phoneNumber: PHONE_NUMBER, code: "12" },
      checkFleetOwnerPhoneVerification,
      { error: INVALID_OTP_MESSAGE, phoneNumber: PHONE_NUMBER, revalidate: false },
    ],
    [
      "verify-account fields",
      { ...validAccountFields, nin: "123" },
      createFleetOwnerAccountVerification,
      { error: INVALID_NIN_MESSAGE, revalidate: false },
    ],
    [
      "verify-account idempotency",
      { ...validAccountFields, idempotencyKey: "not-a-uuid" },
      createFleetOwnerAccountVerification,
      { error: INVALID_UUID_MESSAGE, revalidate: false },
    ],
  ] as const)(
    "rejects invalid %s without calling the mutation API",
    async (_label, fields, mutation, data) => {
      const { result } = await runAction({ ...fields });

      expect(mutation).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        data,
        init: { status: HTTP_STATUS.BAD_REQUEST },
      });
    },
  );

  it("rejects an unknown bank code without trusting the submitted name", async () => {
    const { result } = await runAction({
      ...validAccountFields,
      bankCode: "011",
      bankName: "Access Bank",
    });

    expect(createFleetOwnerAccountVerification).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      data: { error: SELECT_BANK_MESSAGE, revalidate: false },
      init: { status: HTTP_STATUS.BAD_REQUEST },
    });
  });

  it.each([
    [
      "send-phone",
      { intent: "send-phone", phoneNumber: PHONE_NUMBER },
      sendFleetOwnerPhoneVerification,
    ],
    [
      "check-phone",
      { intent: "check-phone", phoneNumber: PHONE_NUMBER, code: "123456" },
      checkFleetOwnerPhoneVerification,
    ],
    ["verify-account", validAccountFields, createFleetOwnerAccountVerification],
  ] as const)("surfaces the API 4xx detail for %s", async (_label, fields, mutation) => {
    mutation.mockRejectedValueOnce(
      apiError(HTTP_STATUS.CONFLICT, "Phone number is already verified."),
    );

    const { result } = await runAction({ ...fields });

    expect(result).toMatchObject({
      data: { error: "Phone number is already verified." },
      init: { status: HTTP_STATUS.CONFLICT },
    });
    expect(actionData(result)).not.toHaveProperty("revalidate");
  });

  it("hides 5xx details behind a generic retry message and omits revalidate so keys can rotate", async () => {
    sendFleetOwnerPhoneVerification.mockRejectedValueOnce(
      apiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, "database exploded"),
    );

    const { result } = await runAction({
      intent: "send-phone",
      phoneNumber: PHONE_NUMBER,
    });

    expect(result).toMatchObject({
      data: { error: ONBOARDING_RETRY },
      init: { status: HTTP_STATUS.INTERNAL_SERVER_ERROR },
    });
    expect(actionData(result)).not.toHaveProperty("revalidate");
    expect(JSON.stringify(result)).not.toContain("database exploded");
  });

  it("hides network details behind a generic retry and keeps revalidate:false", async () => {
    sendFleetOwnerPhoneVerification.mockRejectedValueOnce(
      apiError(HTTP_STATUS.BAD_GATEWAY, "socket hung up", "network"),
    );

    const { result } = await runAction({
      intent: "send-phone",
      phoneNumber: PHONE_NUMBER,
    });

    expect(result).toMatchObject({
      data: { error: ONBOARDING_RETRY, revalidate: false },
      init: { status: HTTP_STATUS.BAD_GATEWAY },
    });
    expect(JSON.stringify(result)).not.toContain("socket hung up");
  });

  it("rejects an invalid replace-driver-license file without calling the mutation API", async () => {
    const { result } = await runAction({
      intent: "replace-driver-license",
      file: INVALID_LICENSE_FILE,
    });

    expect(replaceFleetOwnerDriverLicense).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      data: { error: INVALID_LICENSE_MESSAGE, revalidate: false },
      init: { status: HTTP_STATUS.BAD_REQUEST },
    });
  });

  it("surfaces the API 4xx detail for replace-driver-license and omits revalidate", async () => {
    replaceFleetOwnerDriverLicense.mockRejectedValueOnce(
      apiError(HTTP_STATUS.CONFLICT, "Phone number is already verified."),
    );

    const { result } = await runAction({
      intent: "replace-driver-license",
      file: VALID_LICENSE_FILE,
    });

    expect(result).toMatchObject({
      data: { error: "Phone number is already verified." },
      init: { status: HTTP_STATUS.CONFLICT },
    });
    expect(actionData(result)).not.toHaveProperty("revalidate");
  });

  it("omits revalidate on replace-driver-license HTTP errors so the page can rotate", async () => {
    replaceFleetOwnerDriverLicense.mockRejectedValueOnce(
      apiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, "database exploded"),
    );

    const { result } = await runAction({
      intent: "replace-driver-license",
      file: VALID_LICENSE_FILE,
    });

    expect(result).toMatchObject({
      data: { error: ONBOARDING_RETRY },
      init: { status: HTTP_STATUS.INTERNAL_SERVER_ERROR },
    });
    expect(actionData(result)).not.toHaveProperty("revalidate");
    expect(JSON.stringify(result)).not.toContain("database exploded");
  });

  it("keeps revalidate:false on replace-driver-license network errors", async () => {
    replaceFleetOwnerDriverLicense.mockRejectedValueOnce(
      apiError(HTTP_STATUS.BAD_GATEWAY, "socket hung up", "network"),
    );

    const { result } = await runAction({
      intent: "replace-driver-license",
      file: VALID_LICENSE_FILE,
    });

    expect(result).toMatchObject({
      data: { error: ONBOARDING_RETRY, revalidate: false },
      init: { status: HTTP_STATUS.BAD_GATEWAY },
    });
    expect(JSON.stringify(result)).not.toContain("socket hung up");
  });
});
