import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({
  env: { API_ORIGIN: "https://api.example" },
}));

vi.stubGlobal("fetch", fetchMock);

import {
  checkCurrentUserPhoneVerification,
  getCurrentUserProfile,
  sendCurrentUserPhoneVerification,
} from "./users.server";

const profile = {
  name: "Ada Lovelace",
  phoneNumber: "+2348012345678",
  phoneVerified: true,
  city: "Lagos",
  address: "12 Marina",
  marketingConsent: false,
};

function signedInRequest(path: string) {
  return new Request(`https://tripdly.com${path}`, {
    method: "POST",
    headers: {
      cookie: "better-auth.session_token=session-1",
      "x-request-id": "request-1",
    },
  });
}

function requestInit(call: unknown[]) {
  return call[1] as { method?: string; body?: string; headers: Headers };
}

describe("current user phone verification client", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("reads phoneVerified from the current user profile", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(profile));

    const response = await getCurrentUserProfile({
      request: signedInRequest("/profile"),
    });

    expect(response.data).toEqual(profile);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe("https://api.example/api/users/me");
    expect(requestInit([url, init]).method).toBe("GET");
    expect(requestInit([url, init]).headers.get("cookie")).toBe(
      "better-auth.session_token=session-1",
    );
  });

  it("rejects a profile response that omits phoneVerified", async () => {
    const { phoneVerified: _phoneVerified, ...withoutVerification } = profile;
    fetchMock.mockResolvedValueOnce(Response.json(withoutVerification));

    await expect(
      getCurrentUserProfile({ request: signedInRequest("/profile") }),
    ).rejects.toMatchObject({
      kind: "contract",
      status: 502,
    });
  });

  it("posts a phone verification send", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({ status: "PENDING", phoneNumber: "+234******5678" }),
    );

    const response = await sendCurrentUserPhoneVerification({
      request: signedInRequest("/verify-phone"),
      phoneNumber: "+2348012345678",
    });

    expect(response.data).toEqual({ status: "PENDING", phoneNumber: "+234******5678" });
    const init = requestInit(fetchMock.mock.calls[0] ?? []);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "https://api.example/api/users/me/phone-verifications",
    );
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body ?? "")).toEqual({ phoneNumber: "+2348012345678" });
    expect(init.headers.get("cookie")).toBe("better-auth.session_token=session-1");
    expect(init.headers.get("content-type")).toContain("application/json");
  });

  it("posts a phone verification check", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({ status: "VERIFIED", phoneNumber: "+2348012345678" }),
    );

    const response = await checkCurrentUserPhoneVerification({
      request: signedInRequest("/verify-phone"),
      phoneNumber: "+2348012345678",
      code: "123456",
    });

    expect(response.data.status).toBe("VERIFIED");
    const init = requestInit(fetchMock.mock.calls[0] ?? []);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "https://api.example/api/users/me/phone-verification-checks",
    );
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body ?? "")).toEqual({
      phoneNumber: "+2348012345678",
      code: "123456",
    });
  });

  it("rejects a phone verification response outside the contract", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ status: "EXPIRED", phoneNumber: "+234" }));

    await expect(
      sendCurrentUserPhoneVerification({
        request: signedInRequest("/verify-phone"),
        phoneNumber: "+2348012345678",
      }),
    ).rejects.toMatchObject({
      kind: "contract",
      status: 502,
    });
  });
});
