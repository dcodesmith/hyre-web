import { RouterContextProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getVerificationInterventions } = vi.hoisted(() => ({
  getVerificationInterventions: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({
  env: { API_ORIGIN: "https://api.invalid" },
}));
vi.mock("~/api/admin/interventions/interventions.server", () => ({
  getVerificationInterventions,
}));

import { headers, loader } from "./admin.interventions";

const queue = {
  items: [],
  meta: { page: 1, limit: 100, total: 0, totalPages: 0 },
};

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
});
