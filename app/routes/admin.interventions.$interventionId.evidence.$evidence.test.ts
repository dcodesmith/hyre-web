import { beforeEach, describe, expect, it, vi } from "vitest";

const { getInterventionEvidence } = vi.hoisted(() => ({
  getInterventionEvidence: vi.fn(),
}));

vi.mock("~/api/admin/interventions/interventions.server", () => ({
  getInterventionEvidence,
}));

import { loader } from "./admin.interventions.$interventionId.evidence.$evidence";

const interventionId = "018f47a2-7b3c-7d4e-8f90-1234567894c1";

function loaderArgs(evidence: string) {
  const request = new Request(
    `https://tripdly.com/admin/interventions/${interventionId}/evidence/${evidence}`,
  );
  return {
    request,
    params: { interventionId, evidence },
  } as Parameters<typeof loader>[0];
}

describe("intervention evidence proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("proxies a selfie with no-store headers", async () => {
    getInterventionEvidence.mockResolvedValue(
      new Response("selfie", { headers: { "content-type": "image/webp" } }),
    );

    const response = await loader(loaderArgs("selfie"));

    expect(getInterventionEvidence).toHaveBeenCalledWith(
      expect.any(Request),
      interventionId,
      "selfie",
    );
    expect(response).toBeInstanceOf(Response);
    if (!(response instanceof Response)) {
      throw new Error("expected a response");
    }
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-type")).toBe("image/webp");
    await expect(response.text()).resolves.toBe("selfie");
  });

  it("proxies an NIN portrait and rejects any other evidence name", async () => {
    const portrait = new Response(new Uint8Array([1]));
    portrait.headers.delete("content-type");
    getInterventionEvidence.mockResolvedValue(portrait);

    const response = await loader(loaderArgs("nin-portrait"));
    if (!(response instanceof Response)) {
      throw new Error("expected a response");
    }
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(getInterventionEvidence).toHaveBeenCalledWith(
      expect.any(Request),
      interventionId,
      "nin-portrait",
    );

    await expect(loader(loaderArgs("license-number"))).rejects.toMatchObject({
      init: { status: 404 },
    });
    expect(getInterventionEvidence).toHaveBeenCalledTimes(1);
  });
});
