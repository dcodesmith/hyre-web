import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({
  env: { API_ORIGIN: "https://api.example" },
}));

vi.stubGlobal("fetch", fetchMock);

import {
  acceptChauffeurConsent,
  checkChauffeurPhoneVerification,
  exchangeChauffeurInvitation,
  getChauffeurOnboarding,
  sendChauffeurPhoneVerification,
  verifyChauffeurDriving,
  verifyChauffeurNin,
} from "./chauffeur-onboarding.server";

const SESSION_TOKEN = "session-token-1";
const request = new Request("https://tripdly.com/chauffeur/onboarding", {
  headers: { cookie: "better-auth.session_token=session-1" },
});

const onboarding = {
  id: "chauffeur-1",
  name: "Bola Adebayo",
  email: "bola@example.com",
  phoneNumber: "+2348012345678",
  fleetOwnerName: "Ada Lovelace",
  status: "INVITED",
  steps: { consent: false, phone: false, nin: false, driving: false },
  complianceRequirements: [],
};

const invitationExchange = {
  sessionToken: SESSION_TOKEN,
  sessionExpiresAt: "2026-09-11T13:00:00.000Z",
  onboarding,
};

const phoneVerification = { status: "PENDING", phoneNumber: "+2348012345678" };

function capturedRequest() {
  const [url, init] = fetchMock.mock.calls[0] ?? [];
  return { url: String(url), init, headers: new Headers(init?.headers) };
}

describe("chauffeur onboarding BFF", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("POSTs an invitation token without forwarding a session cookie or bearer", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(invitationExchange));

    const response = await exchangeChauffeurInvitation({ request, token: "invite-token" });

    expect(response.data.sessionToken).toBe(SESSION_TOKEN);
    const { url, init, headers } = capturedRequest();
    expect(url).toBe("https://api.example/api/chauffeur-onboarding/invitation-exchanges");
    expect(init?.method).toBe("POST");
    expect(headers.get("cookie")).toBeNull();
    expect(headers.get("authorization")).toBeNull();
    expect(JSON.parse(String(init?.body))).toEqual({ token: "invite-token" });
  });

  it("GETs onboarding with the bearer session and does not forward the cookie", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(onboarding));

    await getChauffeurOnboarding({ request, sessionToken: SESSION_TOKEN });

    const { url, init, headers } = capturedRequest();
    expect(url).toBe("https://api.example/api/chauffeur-onboarding");
    expect(init?.method).toBe("GET");
    expect(headers.get("authorization")).toBe(`Bearer ${SESSION_TOKEN}`);
    expect(headers.get("cookie")).toBeNull();
  });

  it("PUTs consent JSON with the bearer session", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({
        ...onboarding,
        status: "CONSENTED",
        steps: { ...onboarding.steps, consent: true },
      }),
    );

    await acceptChauffeurConsent({ request, sessionToken: SESSION_TOKEN });

    const { url, init, headers } = capturedRequest();
    expect(url).toBe("https://api.example/api/chauffeur-onboarding/consent");
    expect(init?.method).toBe("PUT");
    expect(headers.get("authorization")).toBe(`Bearer ${SESSION_TOKEN}`);
    expect(JSON.parse(String(init?.body))).toEqual({ termsAccepted: true, privacyAccepted: true });
  });

  it("POSTs phone verification and the verification check with the bearer session", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(phoneVerification));
    await sendChauffeurPhoneVerification({ request, sessionToken: SESSION_TOKEN });
    expect(capturedRequest().url).toBe(
      "https://api.example/api/chauffeur-onboarding/phone-verifications",
    );
    expect(capturedRequest().init?.method).toBe("POST");
    expect(capturedRequest().headers.get("authorization")).toBe(`Bearer ${SESSION_TOKEN}`);

    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(
      Response.json({ status: "VERIFIED", phoneNumber: "+2348012345678" }),
    );
    await checkChauffeurPhoneVerification({
      request,
      sessionToken: SESSION_TOKEN,
      code: "123456",
    });

    const { url, init, headers } = capturedRequest();
    expect(url).toBe("https://api.example/api/chauffeur-onboarding/phone-verification-checks");
    expect(init?.method).toBe("POST");
    expect(headers.get("authorization")).toBe(`Bearer ${SESSION_TOKEN}`);
    expect(JSON.parse(String(init?.body))).toEqual({ code: "123456" });
  });

  it("POSTs NIN verification JSON with Idempotency-Key and the bearer session", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({
        ...onboarding,
        status: "IDENTITY_VERIFIED",
        steps: { consent: true, phone: true, nin: true, driving: false },
      }),
    );

    await verifyChauffeurNin({
      request,
      sessionToken: SESSION_TOKEN,
      idempotencyKey: "nin-1",
      nin: "12345678901",
    });

    const { url, init, headers } = capturedRequest();
    expect(url).toBe("https://api.example/api/chauffeur-onboarding/nin-verifications");
    expect(init?.method).toBe("POST");
    expect(headers.get("authorization")).toBe(`Bearer ${SESSION_TOKEN}`);
    expect(headers.get("Idempotency-Key")).toBe("nin-1");
    expect(headers.get("content-type")).toBe("application/json");
    expect(JSON.parse(String(init?.body))).toEqual({ nin: "12345678901" });
  });

  it("POSTs driving verification multipart with Idempotency-Key and the bearer session", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({
        ...onboarding,
        status: "APPROVED",
        steps: { consent: true, phone: true, nin: true, driving: true },
      }),
    );
    const selfie = new File(["selfie"], "selfie.jpg", { type: "image/jpeg" });
    const formData = new FormData();
    formData.set("driversLicenseNumber", "ABC-12345");
    formData.set("selfie", selfie);

    await verifyChauffeurDriving({
      request,
      sessionToken: SESSION_TOKEN,
      idempotencyKey: "driving-1",
      formData,
    });

    const { url, init, headers } = capturedRequest();
    expect(url).toBe("https://api.example/api/chauffeur-onboarding/driving-verifications");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBeInstanceOf(FormData);
    expect(headers.get("authorization")).toBe(`Bearer ${SESSION_TOKEN}`);
    expect(headers.get("Idempotency-Key")).toBe("driving-1");
    expect(headers.get("content-type")).toBeNull();
    expect(headers.get("cookie")).toBeNull();
    if (!(init?.body instanceof FormData)) {
      throw new Error("expected FormData");
    }
    expect(formData.get("driversLicenseNumber")).toBe("ABC-12345");
    expect(formData.get("selfie")).toBe(selfie);
  });
});
