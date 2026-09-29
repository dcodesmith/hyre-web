import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({
  env: { API_ORIGIN: "https://api.example" },
}));

vi.stubGlobal("fetch", fetchMock);

import {
  approveIntervention,
  approveOwnerLicenseIntervention,
  getInterventionEvidence,
  getInterventionLicenseNumber,
  getVerificationInterventions,
  rejectIntervention,
  requestInterventionSelfieRetake,
} from "./interventions.server";

const interventionId = "018f47a2-7b3c-7d4e-8f90-1234567894c1";
const request = new Request("https://tripdly.com/admin/interventions", {
  headers: { cookie: "better-auth.session_token=session-1" },
});

const queue = {
  items: [],
  meta: { page: 1, limit: 100, total: 0, totalPages: 0 },
};

function capturedRequest() {
  const [url, init] = fetchMock.mock.calls[0] ?? [];
  return { url: String(url), init, headers: new Headers(init?.headers) };
}

describe("admin intervention BFF", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("loads the open queue with the session cookie", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(queue));

    await expect(
      getVerificationInterventions({ request, page: 1, limit: 20 }),
    ).resolves.toMatchObject({ data: queue });

    const { url, init, headers } = capturedRequest();
    expect(url).toBe(
      "https://api.example/api/admin/verification-interventions?status=OPEN&page=1&limit=20",
    );
    expect(init?.method).toBe("GET");
    expect(headers.get("cookie")).toBe("better-auth.session_token=session-1");
  });

  it("reveals a licence number without putting it in the request", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ licenseNumber: "ABC12345DE67" }));

    await expect(getInterventionLicenseNumber(request, interventionId)).resolves.toMatchObject({
      data: { licenseNumber: "ABC12345DE67" },
    });

    const { url, init } = capturedRequest();
    expect(url).toBe(
      `https://api.example/api/admin/verification-interventions/${interventionId}/license-number`,
    );
    expect(init?.method).toBe("GET");
    expect(String(init?.body ?? "")).not.toContain("ABC12345DE67");
  });

  it("requests face evidence as an image", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("image", { headers: { "content-type": "image/webp" } }),
    );

    const response = await getInterventionEvidence(request, interventionId, "selfie");

    expect(response.headers.get("content-type")).toBe("image/webp");
    const { url, headers } = capturedRequest();
    expect(url).toBe(
      `https://api.example/api/admin/verification-interventions/${interventionId}/evidence/selfie`,
    );
    expect(headers.get("accept")).toBe("image/*");
  });

  it("posts approval with the attestation flag and rejection notes", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ success: true }));

    await approveIntervention({
      request,
      interventionId,
      notes: "Checked FRSC",
      source: "FRSC",
      authoritativeSourceAttested: true,
    });
    expect(JSON.parse(String(capturedRequest().init?.body))).toEqual({
      notes: "Checked FRSC",
      source: "FRSC",
      authoritativeSourceAttested: true,
    });
    expect(capturedRequest().url).toContain("/approve");

    fetchMock.mockClear();
    fetchMock.mockResolvedValueOnce(Response.json({ success: true }));
    await rejectIntervention(request, interventionId, "Photo does not match");
    expect(JSON.parse(String(capturedRequest().init?.body))).toEqual({
      notes: "Photo does not match",
    });
    expect(capturedRequest().url).toContain("/reject");

    fetchMock.mockClear();
    fetchMock.mockResolvedValueOnce(Response.json({ success: true }));
    await requestInterventionSelfieRetake(request, interventionId, "Face is unclear");
    expect(JSON.parse(String(capturedRequest().init?.body))).toEqual({
      notes: "Face is unclear",
    });
    expect(capturedRequest().url).toContain("/request-retake");
    expect(capturedRequest().init?.method).toBe("POST");
  });

  it("approves an owner-driver licence by intervention id only", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ success: true }));

    await approveOwnerLicenseIntervention(request, interventionId);

    const { url, init } = capturedRequest();
    expect(url).toBe(
      `https://api.example/api/admin/verification-interventions/${interventionId}/approve-document`,
    );
    expect(init?.method).toBe("POST");
    expect(init?.body).toBeUndefined();
  });

  it("rejects a queue response that includes only a full licence number", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ licenseNumber: "ABC12345DE67" }));

    await expect(
      getVerificationInterventions({ request, page: 1, limit: 20 }),
    ).rejects.toMatchObject({
      kind: "contract",
      status: 502,
    });
  });
});
