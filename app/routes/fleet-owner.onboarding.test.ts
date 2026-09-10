import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const {
  checkFleetOwnerPhoneVerification,
  getFleetOwnerBanks,
  replaceFleetOwnerDriverLicense,
  saveFleetOwnerDrivingCredentials,
  sendFleetOwnerPhoneVerification,
  submitFleetOwnerOnboarding,
  verifyFleetOwnerIdentity,
  verifyFleetOwnerPayout,
} = vi.hoisted(() => ({
  checkFleetOwnerPhoneVerification: vi.fn(),
  getFleetOwnerBanks: vi.fn(),
  replaceFleetOwnerDriverLicense: vi.fn(),
  saveFleetOwnerDrivingCredentials: vi.fn(),
  sendFleetOwnerPhoneVerification: vi.fn(),
  submitFleetOwnerOnboarding: vi.fn(),
  verifyFleetOwnerIdentity: vi.fn(),
  verifyFleetOwnerPayout: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({
  env: { API_ORIGIN: "https://api.invalid" },
}));

vi.mock("~/api/fleet/onboarding/onboarding.server", () => ({
  checkFleetOwnerPhoneVerification,
  getFleetOwnerBanks,
  replaceFleetOwnerDriverLicense,
  saveFleetOwnerDrivingCredentials,
  sendFleetOwnerPhoneVerification,
  submitFleetOwnerOnboarding,
  verifyFleetOwnerIdentity,
  verifyFleetOwnerPayout,
}));

import { ApiRequestError } from "~/api/api.server";
import type { FleetOwnerOnboarding } from "~/api/fleet/onboarding/schema";
import { HTTP_STATUS } from "~/api/http-status";
import {
  onboardingDriverLicenseReplacementFormSchema,
  onboardingDrivingFormSchema,
  onboardingIdentityFormSchema,
  onboardingPayoutFormSchema,
  onboardingPhoneCheckFormSchema,
  onboardingPhoneFormSchema,
} from "~/fleet/onboarding/onboarding-form-schema";
import { action, loader } from "./fleet-owner.onboarding";

const BANKS = [
  { code: "044", name: "Access Bank" },
  { code: "058", name: "GTBank" },
];
const IDEMPOTENCY_KEY = "18aa029c-4bb1-4ca7-b25e-cfc802c4bf8c";
const NEXT_IDEMPOTENCY_KEY = "6d76bdc5-ca7b-43f7-a69b-9fcddc8d46eb";
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
const INVALID_NIN_MESSAGE = firstIssue(onboardingIdentityFormSchema, {
  accountType: "INDIVIDUAL",
  nin: "123",
});
const INVALID_UUID_MESSAGE = firstIssue(z.uuid(), "not-a-uuid");
const SELECT_BANK_MESSAGE = firstIssue(onboardingPayoutFormSchema, {
  bankCode: "",
  accountNumber: "0123456789",
});
const INVALID_LICENSE_FILE = new File([new Uint8Array(32)], "license.gif", { type: "image/gif" });
const INVALID_LICENSE_MESSAGE = firstIssue(onboardingDriverLicenseReplacementFormSchema, {
  file: INVALID_LICENSE_FILE,
});
const MISSING_LICENSE_MESSAGE = firstIssue(onboardingDrivingFormSchema, {
  isOwnerDriver: "true",
});
const VALID_LICENSE_FILE = new File(["%PDF-1.4 licence"], "license.pdf", {
  type: "application/pdf",
});

function parentOnboarding(overrides: Partial<FleetOwnerOnboarding> = {}): FleetOwnerOnboarding {
  return {
    status: "ACTION_REQUIRED",
    accountType: null,
    isOwnerDriver: null,
    emailVerified: true,
    phone: { number: PHONE_NUMBER, verified: true },
    identity: null,
    bank: null,
    documents: { driversLicense: null, lasdri: null },
    requiredActions: [],
    steps: {
      contact: "VERIFIED",
      identity: "PENDING",
      payout: "PENDING",
      driving: "PENDING",
      submission: "PENDING",
    },
    nextAction: "VERIFY_IDENTITY",
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

const validIdentityFields = {
  intent: "verify-identity",
  idempotencyKey: IDEMPOTENCY_KEY,
  accountType: "INDIVIDUAL",
  nin: "12345678901",
} as const;

const validPayoutFields = {
  intent: "verify-payout",
  idempotencyKey: IDEMPOTENCY_KEY,
  bankCode: "058",
  accountNumber: "0123456789",
} as const;

const validDrivingFields = {
  intent: "save-driving",
  idempotencyKey: IDEMPOTENCY_KEY,
  isOwnerDriver: "false",
} as const;

const validSubmitFields = {
  intent: "submit-account",
  idempotencyKey: IDEMPOTENCY_KEY,
} as const;

function apiError(
  status: number,
  detail: string,
  kind: "http" | "network" = "http",
  problem: { errorCode?: string; errors?: unknown[] } = {},
) {
  return new ApiRequestError(kind, status, {
    type: "FLEET_OWNER_ONBOARDING_ERROR",
    title: "Onboarding error",
    status,
    detail,
    ...problem,
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
    verifyFleetOwnerIdentity.mockResolvedValue({
      data: { id: "id-1", status: "VERIFIED" },
    });
    verifyFleetOwnerPayout.mockResolvedValue({
      data: { status: "VERIFIED" },
    });
    saveFleetOwnerDrivingCredentials.mockResolvedValue({
      data: { status: "COMPLETED", isOwnerDriver: false },
    });
    submitFleetOwnerOnboarding.mockResolvedValue({
      data: { id: "ver-1", status: "SUCCEEDED" },
    });
    replaceFleetOwnerDriverLicense.mockResolvedValue({
      data: { status: "PENDING" },
    });
  });

  it("loads banks only when nextAction is VERIFY_PAYOUT", async () => {
    const uuid = vi.spyOn(crypto, "randomUUID").mockReturnValue(IDEMPOTENCY_KEY);
    const { request, args, get } = loaderArgs(parentOnboarding({ nextAction: "VERIFY_PAYOUT" }));

    const result = await loader(args);

    expect(get).toHaveBeenCalled();
    expect(getFleetOwnerBanks).toHaveBeenCalledWith({ request });
    expect(result).toEqual({ banks: BANKS, idempotencyKey: IDEMPOTENCY_KEY });
    uuid.mockRestore();
  });

  it.each(["VERIFY_IDENTITY", "PROVIDE_DRIVING_CREDENTIALS", "WAIT_FOR_REVIEW"] as const)(
    "returns no banks when nextAction is %s",
    async (nextAction) => {
      const uuid = vi.spyOn(crypto, "randomUUID").mockReturnValue(IDEMPOTENCY_KEY);
      const { args, get } = loaderArgs(parentOnboarding({ nextAction }));

      const result = await loader(args);

      expect(get).toHaveBeenCalled();
      expect(getFleetOwnerBanks).not.toHaveBeenCalled();
      expect(result).toEqual({ banks: [], idempotencyKey: IDEMPOTENCY_KEY });
      uuid.mockRestore();
    },
  );

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

  it("verifies identity with sanitized JSON and no extra fields", async () => {
    const { request, result } = await runAction({
      ...validIdentityFields,
      extra: "drop-me",
      bankName: "Evil Bank",
    });

    expect(getFleetOwnerBanks).not.toHaveBeenCalled();
    expect(verifyFleetOwnerIdentity).toHaveBeenCalledWith({
      request,
      idempotencyKey: IDEMPOTENCY_KEY,
      body: { accountType: "INDIVIDUAL", nin: "12345678901" },
    });
    expectRedirect(result, "/fleet-owner/onboarding");
  });

  it("verifies business identity without sending payout fields", async () => {
    const { request, result } = await runAction({
      ...validIdentityFields,
      accountType: "BUSINESS",
      businessName: "Hyre Mobility Limited",
      registrationNumber: "RC123456",
      registrationType: "RC",
      accountNumber: "0123456789",
    });

    expect(verifyFleetOwnerIdentity).toHaveBeenCalledWith({
      request,
      idempotencyKey: IDEMPOTENCY_KEY,
      body: {
        accountType: "BUSINESS",
        nin: "12345678901",
        businessName: "Hyre Mobility Limited",
        registrationNumber: "RC123456",
        registrationType: "RC",
      },
    });
    expectRedirect(result, "/fleet-owner/onboarding");
  });

  it("verifies payout with a bank name derived from the API list", async () => {
    const { request, result } = await runAction({
      ...validPayoutFields,
      bankName: "Evil Bank",
    });

    expect(getFleetOwnerBanks).toHaveBeenCalledWith({ request });
    expect(verifyFleetOwnerPayout).toHaveBeenCalledWith({
      request,
      idempotencyKey: IDEMPOTENCY_KEY,
      body: {
        bankName: "GTBank",
        bankCode: "058",
        accountNumber: "0123456789",
      },
    });
    expect(verifyFleetOwnerPayout.mock.calls[0][0].body.bankName).not.toBe("Evil Bank");
    expectRedirect(result, "/fleet-owner/onboarding");
  });

  it("saves driving credentials with only isOwnerDriver and files", async () => {
    const driversLicense = new File(["%PDF-1.4 licence"], "license.pdf", {
      type: "application/pdf",
    });
    const lasdri = new File(["lasdri"], "lasdri.jpg", { type: "image/jpeg" });
    const { request, result } = await runAction({
      ...validDrivingFields,
      isOwnerDriver: "true",
      extra: "drop-me",
      bankName: "Evil Bank",
      driversLicense,
      lasdri,
    });

    expect(saveFleetOwnerDrivingCredentials).toHaveBeenCalledWith({
      request,
      idempotencyKey: IDEMPOTENCY_KEY,
      formData: expect.any(FormData),
    });
    const sent = saveFleetOwnerDrivingCredentials.mock.calls[0][0].formData as FormData;
    expect(String(sent.get("isOwnerDriver"))).toBe("true");
    expect((sent.get("driversLicense") as File).name).toBe("license.pdf");
    expect((sent.get("lasdri") as File).name).toBe("lasdri.jpg");
    expect(sent.get("intent")).toBeNull();
    expect(sent.get("idempotencyKey")).toBeNull();
    expect(sent.get("extra")).toBeNull();
    expect(sent.get("bankName")).toBeNull();
    expectRedirect(result, "/fleet-owner/onboarding");
  });

  it("submits onboarding without a request body", async () => {
    const { request, result } = await runAction({ ...validSubmitFields, extra: "drop-me" });

    expect(submitFleetOwnerOnboarding).toHaveBeenCalledWith({
      request,
      idempotencyKey: IDEMPOTENCY_KEY,
    });
    expectRedirect(result, "/fleet-owner/onboarding");
  });

  it("returns a licence-required message for submit-account and rotates the key", async () => {
    const uuid = vi.spyOn(crypto, "randomUUID").mockReturnValue(NEXT_IDEMPOTENCY_KEY);
    submitFleetOwnerOnboarding.mockRejectedValueOnce(
      apiError(HTTP_STATUS.UNPROCESSABLE_ENTITY, "Owner driver licence is required", "http", {
        errorCode: "OWNER_DRIVER_LICENSE_REQUIRED",
      }),
    );

    const { result } = await runAction({ ...validSubmitFields });

    expect(result).toMatchObject({
      data: {
        intent: "submit-account",
        idempotencyKey: NEXT_IDEMPOTENCY_KEY,
        revalidate: false,
        error: "Upload your driver's licence to continue.",
      },
      init: { status: HTTP_STATUS.UNPROCESSABLE_ENTITY },
    });
    expect(actionData(result).error).not.toBe(ONBOARDING_RETRY);
    uuid.mockRestore();
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
      "verify-identity fields",
      { ...validIdentityFields, nin: "123" },
      verifyFleetOwnerIdentity,
      {
        idempotencyKey: IDEMPOTENCY_KEY,
        revalidate: false,
        submission: expect.objectContaining({
          error: { nin: [INVALID_NIN_MESSAGE] },
        }),
      },
    ],
    [
      "verify-identity idempotency",
      { ...validIdentityFields, idempotencyKey: "not-a-uuid" },
      verifyFleetOwnerIdentity,
      { error: INVALID_UUID_MESSAGE, revalidate: false },
    ],
    [
      "verify-payout fields",
      { ...validPayoutFields, accountNumber: "123" },
      verifyFleetOwnerPayout,
      {
        idempotencyKey: IDEMPOTENCY_KEY,
        revalidate: false,
        submission: expect.objectContaining({
          error: expect.objectContaining({ accountNumber: expect.any(Array) }),
        }),
      },
    ],
    [
      "verify-payout idempotency",
      { ...validPayoutFields, idempotencyKey: "not-a-uuid" },
      verifyFleetOwnerPayout,
      { error: INVALID_UUID_MESSAGE, revalidate: false },
    ],
    [
      "save-driving fields",
      { ...validDrivingFields, isOwnerDriver: "true" },
      saveFleetOwnerDrivingCredentials,
      {
        idempotencyKey: IDEMPOTENCY_KEY,
        revalidate: false,
        submission: expect.objectContaining({
          error: { driversLicense: [MISSING_LICENSE_MESSAGE] },
        }),
      },
    ],
    [
      "save-driving idempotency",
      { ...validDrivingFields, idempotencyKey: "not-a-uuid" },
      saveFleetOwnerDrivingCredentials,
      { error: INVALID_UUID_MESSAGE, revalidate: false },
    ],
    [
      "submit-account idempotency",
      { ...validSubmitFields, idempotencyKey: "not-a-uuid" },
      submitFleetOwnerOnboarding,
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
      ...validPayoutFields,
      bankCode: "011",
      bankName: "Access Bank",
    });

    expect(verifyFleetOwnerPayout).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      data: {
        idempotencyKey: IDEMPOTENCY_KEY,
        revalidate: false,
        submission: expect.objectContaining({
          error: { bankCode: [SELECT_BANK_MESSAGE] },
        }),
      },
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

  it("highlights a rejected NIN without exposing the provider name and rotates the key", async () => {
    const uuid = vi.spyOn(crypto, "randomUUID").mockReturnValue(NEXT_IDEMPOTENCY_KEY);
    verifyFleetOwnerIdentity.mockRejectedValueOnce(
      apiError(
        HTTP_STATUS.UNPROCESSABLE_ENTITY,
        "Prembly could not verify the supplied information",
        "http",
        {
          errorCode: "ACCOUNT_NIN_NOT_VERIFIED",
          errors: [
            {
              field: "nin",
              code: "NOT_VERIFIED",
              message: "We couldn't verify this NIN. Check the number and try again.",
            },
          ],
        },
      ),
    );

    const { result } = await runAction({ ...validIdentityFields });

    expect(result).toMatchObject({
      data: {
        idempotencyKey: NEXT_IDEMPOTENCY_KEY,
        revalidate: false,
        submission: expect.objectContaining({
          error: {
            nin: ["We couldn't verify this NIN. Check the number and try again."],
          },
        }),
      },
      init: { status: HTTP_STATUS.UNPROCESSABLE_ENTITY },
    });
    expect(JSON.stringify(result)).not.toContain("Prembly");
    uuid.mockRestore();
  });

  it("replaces a reused idempotency key with a retry-safe key and a user-facing message", async () => {
    const uuid = vi.spyOn(crypto, "randomUUID").mockReturnValue(NEXT_IDEMPOTENCY_KEY);
    verifyFleetOwnerIdentity.mockRejectedValueOnce(
      apiError(
        HTTP_STATUS.CONFLICT,
        "This Idempotency-Key was already used with a different request",
        "http",
        { errorCode: "VERIFICATION_IDEMPOTENCY_KEY_REUSED" },
      ),
    );

    const { result } = await runAction({ ...validIdentityFields });

    expect(result).toMatchObject({
      data: {
        idempotencyKey: NEXT_IDEMPOTENCY_KEY,
        revalidate: false,
        submission: expect.objectContaining({
          error: { "": ["Your details changed. Please submit them again."] },
        }),
      },
      init: { status: HTTP_STATUS.CONFLICT },
    });
    expect(JSON.stringify(result)).not.toContain("Idempotency-Key");
    uuid.mockRestore();
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
