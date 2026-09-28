import { RouterContextProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  approveIntervention,
  approveOwnerLicenseIntervention,
  getInterventionLicenseNumber,
  getVerificationInterventions,
  rejectIntervention,
} = vi.hoisted(() => ({
  approveIntervention: vi.fn(),
  approveOwnerLicenseIntervention: vi.fn(),
  getInterventionLicenseNumber: vi.fn(),
  getVerificationInterventions: vi.fn(),
  rejectIntervention: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({
  env: { API_ORIGIN: "https://api.invalid" },
}));
vi.mock("~/api/admin/interventions/interventions.server", () => ({
  approveIntervention,
  approveOwnerLicenseIntervention,
  getInterventionLicenseNumber,
  getVerificationInterventions,
  rejectIntervention,
}));

import { ApiRequestError } from "~/api/api.server";
import { HTTP_STATUS } from "~/api/http-status";
import { action, headers, loader } from "./admin.interventions";

const interventionId = "018f47a2-7b3c-7d4e-8f90-1234567894c1";
const documentId = "018f47a2-7b3c-7d4e-8f90-1234567894c2";
const queue = {
  items: [],
  meta: { page: 1, limit: 100, total: 0, totalPages: 0 },
};

function formData(fields: Record<string, string>) {
  const body = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    body.set(name, value);
  }
  return body;
}

function loaderArgs(search = "") {
  const request = new Request(`https://tripdly.com/admin/interventions${search}`);
  return {
    request,
    url: new URL(request.url),
    pattern: "/admin/interventions",
    params: {},
    context: new RouterContextProvider(),
  } as Parameters<typeof loader>[0];
}

function actionArgs(fields: Record<string, string>) {
  const request = new Request("https://tripdly.com/admin/interventions", {
    method: "POST",
    body: formData(fields),
  });
  return {
    request,
    url: new URL(request.url),
    pattern: "/admin/interventions",
    params: {},
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

describe("admin interventions route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks the page private and not stored", () => {
    expect(headers()).toEqual({ "Cache-Control": "private, no-store" });
  });

  it("loads the open queue", async () => {
    getVerificationInterventions.mockResolvedValue({ data: queue });

    await expect(loader(loaderArgs())).resolves.toEqual(queue);
    expect(getVerificationInterventions).toHaveBeenCalledWith({
      request: expect.any(Request),
      page: 1,
      limit: 20,
    });
  });

  it("requests the selected page and redirects past the last page", async () => {
    getVerificationInterventions.mockResolvedValueOnce({
      data: { items: [], meta: { page: 2, limit: 20, total: 21, totalPages: 2 } },
    });

    await expect(loader(loaderArgs("?page=2"))).resolves.toMatchObject({
      meta: { page: 2, limit: 20 },
    });
    expect(getVerificationInterventions).toHaveBeenLastCalledWith({
      request: expect.any(Request),
      page: 2,
      limit: 20,
    });

    getVerificationInterventions.mockResolvedValueOnce({
      data: { items: [], meta: { page: 1, limit: 20, total: 21, totalPages: 2 } },
    });
    await expect(loader(loaderArgs("?page=nope"))).resolves.toBeDefined();
    expect(getVerificationInterventions).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, limit: 20 }),
    );

    getVerificationInterventions.mockResolvedValueOnce({
      data: { items: [], meta: { page: 1, limit: 20, total: 21, totalPages: 2 } },
    });
    const redirect = await loader(loaderArgs("?page=9")).then(
      () => {
        throw new Error("Expected the loader to redirect");
      },
      (error: unknown) => error,
    );
    expect(redirect).toBeInstanceOf(Response);
    expect(redirect).toMatchObject({ status: 302 });
    expect((redirect as Response).headers.get("Location")).toBe("/admin/interventions?page=2");
    expect((redirect as Response).headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("reveals a licence only for the submitted intervention", async () => {
    getInterventionLicenseNumber.mockResolvedValue({ data: { licenseNumber: "ABC12345DE67" } });

    const result = await action(actionArgs({ intent: "reveal", interventionId }));

    expect(getInterventionLicenseNumber).toHaveBeenCalledWith(expect.any(Request), interventionId);
    expect(result).toMatchObject({
      data: { licenseNumber: "ABC12345DE67", revealedInterventionId: interventionId },
      init: { headers: { "Cache-Control": "private, no-store" } },
    });
  });

  it("sends attestation only when the checkbox is on", async () => {
    approveIntervention.mockResolvedValue({ data: { success: true } });

    await action(
      actionArgs({
        intent: "approve",
        interventionId,
        notes: "Checked FRSC",
        source: "FRSC",
        authoritativeSourceAttested: "on",
      }),
    );
    expect(approveIntervention).toHaveBeenCalledWith({
      request: expect.any(Request),
      interventionId,
      notes: "Checked FRSC",
      source: "FRSC",
      authoritativeSourceAttested: true,
    });

    await action(
      actionArgs({
        intent: "approve",
        interventionId,
        notes: "Visual match",
        source: "VISUAL_COMPARISON",
      }),
    );
    expect(approveIntervention).toHaveBeenLastCalledWith(
      expect.objectContaining({ authoritativeSourceAttested: false, source: "VISUAL_COMPARISON" }),
    );
  });

  it("rejects a review and approves an owner-driver document", async () => {
    rejectIntervention.mockResolvedValue({ data: { success: true } });
    approveOwnerLicenseIntervention.mockResolvedValue({ data: { success: true } });

    const rejected = await action(
      actionArgs({ intent: "reject", interventionId, notes: "Does not match" }),
    );
    expect(rejectIntervention).toHaveBeenCalledWith(
      expect.any(Request),
      interventionId,
      "Does not match",
    );
    expect(rejected).toMatchObject({
      init: { headers: { "Cache-Control": "private, no-store" } },
    });
    expect(rejected.data).toEqual({});

    const approvedDocument = await action(
      actionArgs({ intent: "approve-document", interventionId, documentId }),
    );
    expect(approveOwnerLicenseIntervention).toHaveBeenCalledWith(
      expect.any(Request),
      interventionId,
    );
    expect(approveOwnerLicenseIntervention).not.toHaveBeenCalledWith(
      expect.any(Request),
      documentId,
    );
    expect(approvedDocument.data).toEqual({});
  });

  it("rejects an incomplete review action", async () => {
    const result = await action(actionArgs({ intent: "approve", interventionId, notes: "no" }));

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
      actionArgs({
        intent: "approve",
        interventionId,
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
      actionArgs({ intent: "reject", interventionId, notes: "Does not match" }),
    );
    expect(serverError).toMatchObject({
      data: { error: "Unable to complete this review action. Please try again." },
      init: { status: HTTP_STATUS.INTERNAL_SERVER_ERROR },
    });
    expect(JSON.stringify(serverError)).not.toContain("payload leaked");
  });
});
