import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({
  env: { API_ORIGIN: "https://api.example" },
}));

vi.stubGlobal("fetch", fetchMock);

import {
  createAdminReferralProgram,
  getAdminReferralProgram,
  getAdminReferralProgramHistory,
  updateAdminReferralProgram,
} from "./referrals.server";

const actorId = "018f47a2-7b3c-7d4e-8f90-123456789701";
const createdAt = "2026-01-01T00:00:00.000Z";

const programValues = {
  refereeDiscount: { type: "FIXED" as const, amount: 10_000 },
  referrerReward: { type: "PERCENTAGE" as const, percentage: 10, maxAmount: 20_000 },
  minimumBookingAmount: 50_000,
  eligibleBookingTypes: ["DAY" as const, "FULL_DAY" as const],
  referralValidityDays: 30,
  maxCreditsPerBookingAmount: 30_000,
  maxCreditsPerBookingPercent: 50,
};

const program = {
  id: "current-program",
  status: "ACTIVE",
  ...programValues,
  createdAt,
  updatedAt: createdAt,
  createdById: actorId,
  updatedById: actorId,
};

const history = {
  data: [
    {
      id: "018f47a2-7b3c-7d4e-8f90-1234567890c1",
      action: "CREATED",
      before: null,
      after: program,
      actorId,
      createdAt,
    },
  ],
  pagination: {
    page: 1,
    pageSize: 20,
    totalItems: 1,
    totalPages: 1,
  },
};

const request = new Request("https://tripdly.com/admin/referrals", {
  headers: { cookie: "better-auth.session_token=session-1" },
});

function capturedRequest() {
  const [url, init] = fetchMock.mock.calls[0] ?? [];
  return { url: String(url), init, headers: new Headers(init?.headers) };
}

describe("admin referrals BFF", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("GETs the current programme with the session cookie", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(program));

    const response = await getAdminReferralProgram({ request });

    expect(response.data).toEqual(program);
    const { url, init, headers } = capturedRequest();
    expect(url).toBe("https://api.example/api/admin/referral-program");
    expect(init?.method).toBe("GET");
    expect(headers.get("cookie")).toBe("better-auth.session_token=session-1");
  });

  it("GETs programme history with the first page query", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(history));

    const response = await getAdminReferralProgramHistory({ request });

    expect(response.data).toEqual(history);
    const { url, init, headers } = capturedRequest();
    expect(url).toBe("https://api.example/api/admin/referral-program/history?page=1&pageSize=20");
    expect(init?.method).toBe("GET");
    expect(headers.get("cookie")).toBe("better-auth.session_token=session-1");
  });

  it("POSTs a new programme body", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(program));

    await createAdminReferralProgram({ request, body: programValues });

    const { url, init, headers } = capturedRequest();
    expect(url).toBe("https://api.example/api/admin/referral-program");
    expect(init?.method).toBe("POST");
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("cookie")).toBe("better-auth.session_token=session-1");
    expect(JSON.parse(String(init?.body))).toEqual(programValues);
  });

  it("PATCHes programme values and status", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ ...program, status: "PAUSED" }));

    await updateAdminReferralProgram({
      request,
      body: { ...programValues, status: "PAUSED" },
    });

    const { url, init, headers } = capturedRequest();
    expect(url).toBe("https://api.example/api/admin/referral-program");
    expect(init?.method).toBe("PATCH");
    expect(headers.get("cookie")).toBe("better-auth.session_token=session-1");
    expect(JSON.parse(String(init?.body))).toEqual({ ...programValues, status: "PAUSED" });
  });

  it("rejects an invalid programme contract from the API", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({ ...program, refereeDiscount: { type: "FIXED" } }),
    );

    await expect(getAdminReferralProgram({ request })).rejects.toMatchObject({
      kind: "contract",
      status: 502,
    });
  });
});
