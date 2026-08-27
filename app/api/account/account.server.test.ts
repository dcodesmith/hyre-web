import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({
  env: { API_ORIGIN: "https://api.example" },
}));

vi.stubGlobal("fetch", fetchMock);

import { deleteCurrentUserAccount } from "./account.server";

describe("deleteCurrentUserAccount", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("deletes the signed-in user through the API", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({ success: true }, { headers: { "x-request-id": "request-1" } }),
    );

    const response = await deleteCurrentUserAccount({
      request: new Request("https://tripdly.com/api/account/delete", {
        method: "POST",
        headers: {
          cookie: "better-auth.session_token=session-1",
          "x-request-id": "request-1",
        },
      }),
    });

    expect(response.data).toEqual({ success: true });
    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe("https://api.example/api/account/delete");
    expect(init?.method).toBe("POST");

    const headers = init?.headers as Headers;
    expect(headers.get("cookie")).toBe("better-auth.session_token=session-1");
    expect(headers.get("x-request-id")).toBe("request-1");
  });

  it("rejects an invalid success response", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ success: false }));

    await expect(
      deleteCurrentUserAccount({
        request: new Request("https://tripdly.com/api/account/delete", {
          method: "POST",
          headers: { cookie: "better-auth.session_token=session-1" },
        }),
      }),
    ).rejects.toMatchObject({
      kind: "contract",
      status: 502,
    });
  });
});
