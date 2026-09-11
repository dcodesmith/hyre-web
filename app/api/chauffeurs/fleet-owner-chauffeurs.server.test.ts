import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({
  env: { API_ORIGIN: "https://api.example" },
}));

vi.stubGlobal("fetch", fetchMock);

import {
  getFleetOwnerChauffeurs,
  inviteFleetOwnerChauffeur,
  updateFleetOwnerChauffeur,
} from "./fleet-owner-chauffeurs.server";

const request = new Request("https://tripdly.com/fleet-owner/chauffeurs", {
  headers: { cookie: "better-auth.session_token=session-1" },
});

const chauffeur = {
  id: "invite-1",
  chauffeurId: "chauffeur-1",
  name: "Bola Adebayo",
  email: "bola@example.com",
  phoneNumber: "+2348012345678",
  status: "APPROVED",
  isActive: true,
  image: null,
  invitedAt: "2026-08-20T12:00:00.000Z",
};

const chauffeurs = {
  items: [chauffeur],
  meta: { page: 2, limit: 20, total: 21, totalPages: 2 },
  complianceRequirements: [{ type: "LASDRI", label: "LASDRI card", required: false }],
};

function capturedRequest() {
  const [url, init] = fetchMock.mock.calls[0] ?? [];
  return { url: String(url), init, headers: new Headers(init?.headers) };
}

describe("fleet-owner chauffeurs BFF", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("GETs chauffeurs with the list query and forwards the session cookie", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(chauffeurs));

    const response = await getFleetOwnerChauffeurs({
      request,
      searchParams: new URLSearchParams({ page: "2", limit: "20" }),
    });

    expect(response.data.meta.page).toBe(2);
    const { url, init, headers } = capturedRequest();
    expect(url).toBe("https://api.example/api/fleet-owner/chauffeurs?page=2&limit=20");
    expect(init?.method).toBe("GET");
    expect(headers.get("cookie")).toBe("better-auth.session_token=session-1");
  });

  it("POSTs an invitation with Idempotency-Key and the session cookie", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(chauffeur));

    await inviteFleetOwnerChauffeur({
      request,
      idempotencyKey: "invite-1",
      body: {
        name: "Bola Adebayo",
        email: "bola@example.com",
        phoneNumber: "+2348012345678",
      },
    });

    const { url, init, headers } = capturedRequest();
    expect(url).toBe("https://api.example/api/fleet-owner/chauffeur-invitations");
    expect(init?.method).toBe("POST");
    expect(headers.get("cookie")).toBe("better-auth.session_token=session-1");
    expect(headers.get("Idempotency-Key")).toBe("invite-1");
    expect(headers.get("content-type")).toBe("application/json");
    expect(JSON.parse(String(init?.body))).toEqual({
      name: "Bola Adebayo",
      email: "bola@example.com",
      phoneNumber: "+2348012345678",
    });
  });

  it("PATCHes chauffeur activation JSON and URL-encodes the chauffeur id", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ ...chauffeur, isActive: false }));

    await updateFleetOwnerChauffeur({
      request,
      chauffeurId: "chauffeur/1+x",
      isActive: false,
    });

    const { url, init, headers } = capturedRequest();
    expect(url).toBe("https://api.example/api/fleet-owner/chauffeurs/chauffeur%2F1%2Bx");
    expect(init?.method).toBe("PATCH");
    expect(headers.get("cookie")).toBe("better-auth.session_token=session-1");
    expect(JSON.parse(String(init?.body))).toEqual({ isActive: false });
  });
});
