import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({
  env: { API_ORIGIN: "https://api.example" },
}));

vi.stubGlobal("fetch", fetchMock);

import {
  checkFleetOwnerPhoneVerification,
  createFleetOwnerAccountVerification,
  getFleetOwnerBanks,
  getFleetOwnerOnboarding,
  replaceFleetOwnerDriverLicense,
  sendFleetOwnerPhoneVerification,
} from "./onboarding.server";

const request = new Request("https://tripdly.com/fleet-owner/onboarding", {
  headers: { cookie: "better-auth.session_token=session-1" },
});

const banks = [{ code: "058", name: "GTBank" }];
const onboarding = {
  status: "ACTION_REQUIRED",
  accountType: null,
  isOwnerDriver: false,
  emailVerified: true,
  phone: { number: "**********5678", verified: false },
  identity: null,
  bank: null,
  documents: { driversLicense: null, lasdri: null },
  requiredActions: ["VERIFY_PHONE", "VERIFY_ACCOUNT"],
};
const phoneVerification = { status: "PENDING", phoneNumber: "**********5678" };
const accountVerification = {
  id: "ver-1",
  status: "SUCCEEDED",
  accountType: "INDIVIDUAL",
  isOwnerDriver: false,
  legalName: "JOHN MIDDLE DOE",
  businessName: null,
  bank: {
    bankName: "GTBank",
    accountName: "JOHN DOE",
    accountNumber: "******6789",
    nameMatch: "MATCHED",
  },
};

function capturedRequest() {
  const [url, init] = fetchMock.mock.calls[0] ?? [];
  return { url: String(url), init, headers: new Headers(init?.headers) };
}

describe("fleet-owner onboarding BFF", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("GETs banks and forwards the session cookie", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(banks));

    const response = await getFleetOwnerBanks({ request });

    expect(response.data).toEqual(banks);
    const { url, init, headers } = capturedRequest();
    expect(url).toBe("https://api.example/api/fleet-owner/banks");
    expect(init?.method).toBe("GET");
    expect(headers.get("cookie")).toBe("better-auth.session_token=session-1");
  });

  it("GETs onboarding status and forwards the session cookie", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(onboarding));

    const response = await getFleetOwnerOnboarding({ request });

    expect(response.data.status).toBe("ACTION_REQUIRED");
    const { url, init, headers } = capturedRequest();
    expect(url).toBe("https://api.example/api/fleet-owner/onboarding");
    expect(init?.method).toBe("GET");
    expect(headers.get("cookie")).toBe("better-auth.session_token=session-1");
  });

  it("POSTs phone verification JSON and forwards the session cookie", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(phoneVerification));

    await sendFleetOwnerPhoneVerification({
      request,
      body: { phoneNumber: "+2348012345678" },
    });

    const { url, init, headers } = capturedRequest();
    expect(url).toBe("https://api.example/api/fleet-owner/phone-verifications");
    expect(init?.method).toBe("POST");
    expect(headers.get("cookie")).toBe("better-auth.session_token=session-1");
    expect(JSON.parse(String(init?.body))).toEqual({ phoneNumber: "+2348012345678" });
  });

  it("POSTs phone verification check JSON and forwards the session cookie", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({ status: "VERIFIED", phoneNumber: "**********5678" }),
    );

    await checkFleetOwnerPhoneVerification({
      request,
      body: { phoneNumber: "+2348012345678", code: "123456" },
    });

    const { url, init, headers } = capturedRequest();
    expect(url).toBe("https://api.example/api/fleet-owner/phone-verification-checks");
    expect(init?.method).toBe("POST");
    expect(headers.get("cookie")).toBe("better-auth.session_token=session-1");
    expect(JSON.parse(String(init?.body))).toEqual({
      phoneNumber: "+2348012345678",
      code: "123456",
    });
  });

  it("POSTs multipart account verification with Idempotency-Key and the session cookie", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(accountVerification));
    const formData = new FormData();
    formData.set("accountType", "INDIVIDUAL");
    formData.set("nin", "12345678901");
    formData.set("isOwnerDriver", "true");
    formData.set("bankName", "GTBank");
    formData.set("bankCode", "058");
    formData.set("accountNumber", "0123456789");
    formData.set(
      "driversLicense",
      new File(["%PDF-1.4 licence"], "license.pdf", { type: "application/pdf" }),
    );

    await createFleetOwnerAccountVerification({
      request,
      idempotencyKey: "account-1",
      formData,
    });

    const { url, init, headers } = capturedRequest();
    expect(url).toBe("https://api.example/api/fleet-owner/account-verifications");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBeInstanceOf(FormData);
    expect(headers.get("cookie")).toBe("better-auth.session_token=session-1");
    expect(headers.get("Idempotency-Key")).toBe("account-1");
    expect(headers.get("content-type")).toBeNull();
  });

  it("PUTs multipart driver-licence replacement as file and forwards the session cookie", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ status: "PENDING" }));
    const file = new File(["%PDF-1.4 licence"], "license.pdf", { type: "application/pdf" });

    const response = await replaceFleetOwnerDriverLicense({ request, file });

    expect(response.data).toEqual({ status: "PENDING" });
    const { url, init, headers } = capturedRequest();
    expect(url).toBe("https://api.example/api/fleet-owner/documents/drivers-license");
    expect(init?.method).toBe("PUT");
    const formData = init?.body as FormData;
    expect(formData).toBeInstanceOf(FormData);
    expect(formData.get("file")).toBe(file);
    expect(headers.get("cookie")).toBe("better-auth.session_token=session-1");
    expect(headers.get("content-type")).toBeNull();
  });
});
