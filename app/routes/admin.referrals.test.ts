import { RouterContextProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createAdminReferralProgram,
  getAdminReferralProgram,
  getAdminReferralProgramHistory,
  updateAdminReferralProgram,
} = vi.hoisted(() => ({
  createAdminReferralProgram: vi.fn(),
  getAdminReferralProgram: vi.fn(),
  getAdminReferralProgramHistory: vi.fn(),
  updateAdminReferralProgram: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({
  env: { API_ORIGIN: "https://api.invalid" },
}));
vi.mock("~/api/admin/referrals/referrals.server", () => ({
  createAdminReferralProgram,
  getAdminReferralProgram,
  getAdminReferralProgramHistory,
  updateAdminReferralProgram,
}));

import { ApiRequestError } from "~/api/api.server";
import { HTTP_STATUS } from "~/api/http-status";
import { action, loader, shouldRevalidate } from "./admin.referrals";

const actorId = "018f47a2-7b3c-7d4e-8f90-123456789701";
const createdAt = "2026-01-01T00:00:00.000Z";

const program = {
  id: "current-program",
  status: "ACTIVE" as const,
  refereeDiscount: { type: "FIXED" as const, amount: 10_000 },
  referrerReward: { type: "FIXED" as const, amount: 5_000 },
  minimumBookingAmount: 50_000,
  eligibleBookingTypes: ["DAY" as const, "FULL_DAY" as const],
  referralValidityDays: 30,
  maxCreditsPerBookingAmount: 30_000,
  maxCreditsPerBookingPercent: 50,
  createdAt,
  updatedAt: createdAt,
  createdById: actorId,
  updatedById: actorId,
};

const history = {
  data: [],
  pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
};

const validForm = {
  refereeDiscountType: "FIXED",
  refereeDiscountAmount: "10000",
  referrerRewardType: "FIXED",
  referrerRewardAmount: "5000",
  minimumBookingAmount: "50000",
  referralValidityDays: "30",
  maxCreditsPerBookingAmount: "30000",
  maxCreditsPerBookingPercent: "50",
};

function programBody() {
  return {
    refereeDiscount: { type: "FIXED" as const, amount: 10_000 },
    referrerReward: { type: "FIXED" as const, amount: 5_000 },
    minimumBookingAmount: 50_000,
    eligibleBookingTypes: ["DAY", "FULL_DAY"],
    referralValidityDays: 30,
    maxCreditsPerBookingAmount: 30_000,
    maxCreditsPerBookingPercent: 50,
  };
}

function formData(fields: Record<string, string | string[]>) {
  const body = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        body.append(name, item);
      }
    } else {
      body.set(name, value);
    }
  }
  return body;
}

function loaderArgs(request = new Request("https://tripdly.com/admin/referrals")) {
  return {
    request,
    url: new URL(request.url),
    pattern: "/admin/referrals",
    params: {},
    context: new RouterContextProvider(),
  } as Parameters<typeof loader>[0];
}

function actionArgs(fields: Record<string, string | string[]>) {
  return {
    request: new Request("https://tripdly.com/admin/referrals", {
      method: "POST",
      body: formData(fields),
    }),
    url: new URL("https://tripdly.com/admin/referrals"),
    pattern: "/admin/referrals",
    params: {},
    context: new RouterContextProvider(),
  } as Parameters<typeof action>[0];
}

function apiError(status: number, detail: string, kind: "aborted" | "http" = "http") {
  return new ApiRequestError(kind, status, {
    type: "REFERRAL_PROGRAM_ERROR",
    title: "Referral programme error",
    status,
    detail,
  });
}

describe("admin referrals loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the current programme and history", async () => {
    getAdminReferralProgram.mockResolvedValue({ data: program });
    getAdminReferralProgramHistory.mockResolvedValue({ data: history });

    await expect(loader(loaderArgs())).resolves.toEqual({ program, history });
  });

  it("treats an unconfigured programme as null and still loads history", async () => {
    getAdminReferralProgram.mockRejectedValue(
      apiError(HTTP_STATUS.NOT_FOUND, "Referral programme is not configured"),
    );
    getAdminReferralProgramHistory.mockResolvedValue({ data: history });

    await expect(loader(loaderArgs())).resolves.toEqual({ program: null, history });
  });

  it("rethrows a non-404 programme error", async () => {
    const error = apiError(HTTP_STATUS.BAD_GATEWAY, "Upstream failed");
    getAdminReferralProgram.mockRejectedValue(error);
    getAdminReferralProgramHistory.mockResolvedValue({ data: history });

    await expect(loader(loaderArgs())).rejects.toBe(error);
  });
});

describe("admin referrals action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a programme from a valid form", async () => {
    createAdminReferralProgram.mockResolvedValue({ data: program });

    const result = await action(
      actionArgs({
        intent: "create",
        ...validForm,
        eligibleBookingTypes: ["DAY", "FULL_DAY"],
      }),
    );

    expect(createAdminReferralProgram).toHaveBeenCalledWith({
      request: expect.any(Request),
      body: programBody(),
    });
    expect(result).toMatchObject({
      data: { intent: "create", success: "Referral programme created and activated." },
    });
  });

  it("updates a programme from a valid form", async () => {
    updateAdminReferralProgram.mockResolvedValue({ data: program });

    const result = await action(
      actionArgs({
        intent: "update",
        ...validForm,
        eligibleBookingTypes: ["DAY", "FULL_DAY"],
      }),
    );

    expect(updateAdminReferralProgram).toHaveBeenCalledWith({
      request: expect.any(Request),
      body: programBody(),
    });
    expect(result).toMatchObject({
      data: { intent: "update", success: "Referral programme updated." },
    });
  });

  it("pauses and resumes the programme", async () => {
    updateAdminReferralProgram.mockResolvedValue({ data: { ...program, status: "PAUSED" } });

    const paused = await action(actionArgs({ intent: "status", status: "PAUSED" }));
    expect(updateAdminReferralProgram).toHaveBeenCalledWith({
      request: expect.any(Request),
      body: { status: "PAUSED" },
    });
    expect(paused).toMatchObject({
      data: { intent: "status", success: "Referral programme paused." },
    });

    updateAdminReferralProgram.mockResolvedValue({ data: program });
    const resumed = await action(actionArgs({ intent: "status", status: "ACTIVE" }));
    expect(resumed).toMatchObject({
      data: { intent: "status", success: "Referral programme resumed." },
    });
  });

  it("returns validation failures without calling the API and skips revalidation", async () => {
    const result = await action(
      actionArgs({
        intent: "create",
        ...validForm,
        refereeDiscountAmount: "",
        eligibleBookingTypes: ["DAY"],
      }),
    );

    expect(createAdminReferralProgram).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      data: { intent: "create", revalidate: false },
      init: { status: HTTP_STATUS.BAD_REQUEST },
    });
    expect(
      shouldRevalidate({
        actionResult: result.data,
        defaultShouldRevalidate: true,
      } as Parameters<typeof shouldRevalidate>[0]),
    ).toBe(false);
  });

  it("rejects an invalid status before calling the API", async () => {
    const result = await action(actionArgs({ intent: "status", status: "ARCHIVED" }));

    expect(updateAdminReferralProgram).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      data: { intent: "status", error: "Select a valid programme status.", revalidate: false },
      init: { status: HTTP_STATUS.BAD_REQUEST },
    });
  });

  it("surfaces safe API details and hides server errors", async () => {
    updateAdminReferralProgram.mockRejectedValueOnce(
      apiError(HTTP_STATUS.CONFLICT, "A referral programme already exists"),
    );
    const conflict = await action(
      actionArgs({
        intent: "update",
        ...validForm,
        eligibleBookingTypes: ["DAY", "FULL_DAY"],
      }),
    );
    expect(conflict).toMatchObject({
      data: { intent: "update", error: "A referral programme already exists" },
      init: { status: HTTP_STATUS.CONFLICT },
    });

    updateAdminReferralProgram.mockRejectedValueOnce(
      apiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, "database exploded"),
    );
    const hidden = await action(
      actionArgs({
        intent: "update",
        ...validForm,
        eligibleBookingTypes: ["DAY", "FULL_DAY"],
      }),
    );
    expect(hidden).toMatchObject({
      data: { intent: "update", error: "Unable to save the referral programme." },
      init: { status: HTTP_STATUS.INTERNAL_SERVER_ERROR },
    });
  });

  it("hides 5xx status-change details and rethrows aborted requests", async () => {
    updateAdminReferralProgram.mockRejectedValueOnce(
      apiError(HTTP_STATUS.BAD_GATEWAY, "upstream exploded"),
    );
    const hidden = await action(actionArgs({ intent: "status", status: "PAUSED" }));
    expect(hidden).toMatchObject({
      data: {
        intent: "status",
        error: "Unable to change the programme status.",
        revalidate: false,
      },
      init: { status: HTTP_STATUS.BAD_GATEWAY },
    });

    const aborted = apiError(HTTP_STATUS.CLIENT_CLOSED_REQUEST, "Aborted", "aborted");
    updateAdminReferralProgram.mockRejectedValueOnce(aborted);
    await expect(action(actionArgs({ intent: "status", status: "PAUSED" }))).rejects.toBe(aborted);
  });

  it("rejects an unknown intent", async () => {
    const result = await action(actionArgs({ intent: "delete" })).catch((error: unknown) => error);

    expect(result).toMatchObject({ init: { status: HTTP_STATUS.BAD_REQUEST } });
  });

  it("revalidates after a successful save", () => {
    expect(
      shouldRevalidate({
        actionResult: { intent: "create", success: "Referral programme created and activated." },
        defaultShouldRevalidate: true,
      } as Parameters<typeof shouldRevalidate>[0]),
    ).toBe(true);
  });
});
