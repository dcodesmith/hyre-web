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
  getFleetOwnerBanks,
  getFleetOwnerOnboarding,
  replaceFleetOwnerDriverLicense,
  saveFleetOwnerDrivingCredentials,
  sendFleetOwnerPhoneVerification,
  submitFleetOwnerOnboarding,
  verifyFleetOwnerIdentity,
  verifyFleetOwnerPayout,
} from "./onboarding.server";

const request = new Request("https://tripdly.com/fleet-owner/onboarding", {
  headers: { cookie: "better-auth.session_token=session-1" },
});

const banks = [{ code: "058", name: "GTBank" }];
const onboarding = {
  status: "ACTION_REQUIRED",
  accountType: null,
  isOwnerDriver: null,
  emailVerified: true,
  phone: { number: "**********5678", verified: false },
  identity: null,
  bank: null,
  documents: { driversLicense: null, lasdri: null },
  requiredActions: ["VERIFY_PHONE"],
  steps: {
    contact: "PENDING",
    identity: "PENDING",
    payout: "PENDING",
    driving: "PENDING",
    submission: "PENDING",
  },
  nextAction: "VERIFY_PHONE",
};
const phoneVerification = { status: "PENDING", phoneNumber: "**********5678" };
const identityVerification = {
  id: "id-1",
  status: "VERIFIED",
  accountType: "INDIVIDUAL",
  legalName: "JOHN MIDDLE DOE",
  businessName: null,
};
const payoutVerification = {
  status: "VERIFIED",
  bank: {
    bankName: "GTBank",
    accountName: "JOHN DOE",
    accountNumber: "******6789",
    nameMatch: "MATCHED",
  },
};
const drivingCredentials = {
  status: "COMPLETED",
  isOwnerDriver: false,
  documents: { driversLicense: null, lasdri: null },
};
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
    expect(response.data.nextAction).toBe("VERIFY_PHONE");
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

  it("POSTs identity verification JSON with Idempotency-Key and the session cookie", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(identityVerification));

    await verifyFleetOwnerIdentity({
      request,
      idempotencyKey: "identity-1",
      body: { accountType: "INDIVIDUAL", nin: "12345678901" },
    });

    const { url, init, headers } = capturedRequest();
    expect(url).toBe("https://api.example/api/fleet-owner/onboarding/identity-verifications");
    expect(init?.method).toBe("POST");
    expect(headers.get("cookie")).toBe("better-auth.session_token=session-1");
    expect(headers.get("Idempotency-Key")).toBe("identity-1");
    expect(headers.get("content-type")).toBe("application/json");
    expect(JSON.parse(String(init?.body))).toEqual({
      accountType: "INDIVIDUAL",
      nin: "12345678901",
    });
  });

  it("POSTs payout verification JSON with Idempotency-Key and the session cookie", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(payoutVerification));

    await verifyFleetOwnerPayout({
      request,
      idempotencyKey: "payout-1",
      body: { bankName: "GTBank", bankCode: "058", accountNumber: "0123456789" },
    });

    const { url, init, headers } = capturedRequest();
    expect(url).toBe("https://api.example/api/fleet-owner/onboarding/payout-verifications");
    expect(init?.method).toBe("POST");
    expect(headers.get("cookie")).toBe("better-auth.session_token=session-1");
    expect(headers.get("Idempotency-Key")).toBe("payout-1");
    expect(headers.get("content-type")).toBe("application/json");
    expect(JSON.parse(String(init?.body))).toEqual({
      bankName: "GTBank",
      bankCode: "058",
      accountNumber: "0123456789",
    });
  });

  it("PUTs multipart driving credentials with Idempotency-Key and the session cookie", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(drivingCredentials));
    const formData = new FormData();
    formData.set("isOwnerDriver", "false");

    await saveFleetOwnerDrivingCredentials({
      request,
      idempotencyKey: "driving-1",
      formData,
    });

    const { url, init, headers } = capturedRequest();
    expect(url).toBe("https://api.example/api/fleet-owner/onboarding/driving-credentials");
    expect(init?.method).toBe("PUT");
    expect(init?.body).toBeInstanceOf(FormData);
    expect(headers.get("cookie")).toBe("better-auth.session_token=session-1");
    expect(headers.get("Idempotency-Key")).toBe("driving-1");
    expect(headers.get("content-type")).toBeNull();
  });

  it("POSTs onboarding submission with Idempotency-Key and no body", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(accountVerification));

    await submitFleetOwnerOnboarding({
      request,
      idempotencyKey: "submit-1",
    });

    const { url, init, headers } = capturedRequest();
    expect(url).toBe("https://api.example/api/fleet-owner/onboarding/submissions");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBeUndefined();
    expect(headers.get("cookie")).toBe("better-auth.session_token=session-1");
    expect(headers.get("Idempotency-Key")).toBe("submit-1");
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
