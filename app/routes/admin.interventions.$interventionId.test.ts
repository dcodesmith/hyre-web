import { RouterContextProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  approveIntervention,
  approveOwnerLicenseIntervention,
  getInterventionLicenseNumber,
  getVerificationIntervention,
  rejectIntervention,
  requestInterventionSelfieRetake,
} = vi.hoisted(() => ({
  approveIntervention: vi.fn(),
  approveOwnerLicenseIntervention: vi.fn(),
  getInterventionLicenseNumber: vi.fn(),
  getVerificationIntervention: vi.fn(),
  rejectIntervention: vi.fn(),
  requestInterventionSelfieRetake: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({
  env: { API_ORIGIN: "https://api.invalid" },
}));
vi.mock("~/api/admin/interventions/interventions.server", () => ({
  approveIntervention,
  approveOwnerLicenseIntervention,
  getInterventionLicenseNumber,
  getVerificationIntervention,
  rejectIntervention,
  requestInterventionSelfieRetake,
}));

import { ApiRequestError } from "~/api/api.server";
import { HTTP_STATUS } from "~/api/http-status";
import { action, headers, loader } from "./admin.interventions.$interventionId";

const interventionId = "018f47a2-7b3c-7d4e-8f90-1234567894c1";
const review = {
  id: interventionId,
  kind: "CHAUFFEUR_DRIVERS_LICENSE",
  status: "OPEN",
  applicantName: "Ada Lovelace",
  licenseLast4: "DE67",
  hasSelfie: false,
  hasNinPortrait: false,
  document: null,
  createdAt: "2026-09-26T12:00:00.000Z",
};

function formData(fields: Record<string, string>) {
  const body = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    body.set(name, value);
  }
  return body;
}

function routeArgs(id = interventionId, fields?: Record<string, string>) {
  const request = new Request(`https://tripdly.com/admin/interventions/${id}`, {
    method: fields ? "POST" : "GET",
    body: fields ? formData(fields) : undefined,
  });
  return {
    request,
    url: new URL(request.url),
    pattern: "/admin/interventions/:interventionId",
    params: { interventionId: id },
    context: new RouterContextProvider(),
  } as Parameters<typeof action>[0];
}

function apiError(status: number, detail: string) {
  return new ApiRequestError("http", status, {
    type: "INTERVENTION_ERROR",
    title: "Intervention error",
    status,
    detail,
  });
}

function expectQueueRedirect(result: unknown) {
  expect(result).toBeInstanceOf(Response);
  if (!(result instanceof Response)) {
    throw new Error("Expected a redirect response");
  }
  expect(result.status).toBe(302);
  expect(result.headers.get("location")).toBe("/admin/interventions");
  expect(result.headers.get("cache-control")).toBe("private, no-store");
}

describe("admin intervention detail route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks the page private and not stored", () => {
    expect(headers()).toEqual({ "Cache-Control": "private, no-store" });
  });

  it("loads one review from the route id", async () => {
    getVerificationIntervention.mockResolvedValue({ data: review });

    await expect(loader(routeArgs())).resolves.toEqual(review);
    expect(getVerificationIntervention).toHaveBeenCalledWith({
      request: expect.any(Request),
      interventionId,
    });
  });

  it("returns not found for a bad id or a missing review", async () => {
    const missingId = await loader(routeArgs("not-a-uuid")).catch((error: unknown) => error);
    expect(getVerificationIntervention).not.toHaveBeenCalled();
    expect(missingId).toMatchObject({
      init: { status: HTTP_STATUS.NOT_FOUND },
    });

    getVerificationIntervention.mockRejectedValueOnce(
      apiError(HTTP_STATUS.NOT_FOUND, "Review not found"),
    );
    const missing = await loader(routeArgs()).catch((error: unknown) => error);
    expect(missing).toMatchObject({ init: { status: HTTP_STATUS.NOT_FOUND } });
  });

  it("reveals a licence for the review in the url", async () => {
    getInterventionLicenseNumber.mockResolvedValue({ data: { licenseNumber: "ABC12345DE67" } });

    const result = await action(routeArgs(interventionId, { intent: "reveal" }));

    expect(getInterventionLicenseNumber).toHaveBeenCalledWith(expect.any(Request), interventionId);
    expect(result).toMatchObject({
      data: { licenseNumber: "ABC12345DE67" },
      init: { headers: { "Cache-Control": "private, no-store" } },
    });
  });

  it("sends attestation only when the checkbox is on", async () => {
    approveIntervention.mockResolvedValue({ data: { success: true } });

    expectQueueRedirect(
      await action(
        routeArgs(interventionId, {
          intent: "approve",
          notes: "Checked FRSC",
          source: "FRSC",
          authoritativeSourceAttested: "on",
        }),
      ),
    );
    expect(approveIntervention).toHaveBeenCalledWith({
      request: expect.any(Request),
      interventionId,
      notes: "Checked FRSC",
      source: "FRSC",
      authoritativeSourceAttested: true,
    });

    expectQueueRedirect(
      await action(
        routeArgs(interventionId, {
          intent: "approve",
          notes: "Visual match",
          source: "VISUAL_COMPARISON",
        }),
      ),
    );
    expect(approveIntervention).toHaveBeenLastCalledWith(
      expect.objectContaining({ authoritativeSourceAttested: false, source: "VISUAL_COMPARISON" }),
    );
  });

  it("returns to the queue after reject, retake, and document approval", async () => {
    rejectIntervention.mockResolvedValue({ data: { success: true } });
    requestInterventionSelfieRetake.mockResolvedValue({ data: { success: true } });
    approveOwnerLicenseIntervention.mockResolvedValue({ data: { success: true } });

    expectQueueRedirect(
      await action(routeArgs(interventionId, { intent: "reject", notes: "Does not match" })),
    );
    expect(rejectIntervention).toHaveBeenCalledWith(
      expect.any(Request),
      interventionId,
      "Does not match",
    );

    expectQueueRedirect(
      await action(
        routeArgs(interventionId, { intent: "request-retake", notes: "Face is unclear" }),
      ),
    );
    expect(requestInterventionSelfieRetake).toHaveBeenCalledWith(
      expect.any(Request),
      interventionId,
      "Face is unclear",
    );
    expect(rejectIntervention).toHaveBeenCalledTimes(1);

    expectQueueRedirect(await action(routeArgs(interventionId, { intent: "approve-document" })));
    expect(approveOwnerLicenseIntervention).toHaveBeenCalledWith(
      expect.any(Request),
      interventionId,
    );
  });

  it("rejects an incomplete review action", async () => {
    const result = await action(routeArgs(interventionId, { intent: "approve", notes: "no" }));

    expect(approveIntervention).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      data: { error: expect.any(String) },
      init: { status: HTTP_STATUS.BAD_REQUEST },
    });
  });

  it("returns the upstream detail for a client error and hides server failures", async () => {
    approveIntervention.mockRejectedValueOnce(
      apiError(HTTP_STATUS.UNPROCESSABLE_ENTITY, "Attestation required"),
    );
    const clientError = await action(
      routeArgs(interventionId, {
        intent: "approve",
        notes: "Checked FRSC",
        source: "FRSC",
        authoritativeSourceAttested: "on",
      }),
    );
    expect(clientError).toMatchObject({
      data: { error: "Attestation required" },
      init: { status: HTTP_STATUS.UNPROCESSABLE_ENTITY },
    });

    rejectIntervention.mockRejectedValueOnce(
      apiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, "payload leaked"),
    );
    const serverError = await action(
      routeArgs(interventionId, { intent: "reject", notes: "Does not match" }),
    );
    expect(serverError).toMatchObject({
      data: { error: "Unable to complete this review action. Please try again." },
      init: { status: HTTP_STATUS.INTERNAL_SERVER_ERROR },
    });
    expect(JSON.stringify(serverError)).not.toContain("payload leaked");
  });
});
