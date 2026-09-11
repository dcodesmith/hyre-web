import { RouterContextProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getFleetOwnerChauffeurs, inviteFleetOwnerChauffeur, updateFleetOwnerChauffeur } =
  vi.hoisted(() => ({
    getFleetOwnerChauffeurs: vi.fn(),
    inviteFleetOwnerChauffeur: vi.fn(),
    updateFleetOwnerChauffeur: vi.fn(),
  }));

vi.mock("cloudflare:workers", () => ({
  env: { API_ORIGIN: "https://api.invalid" },
}));

vi.mock("~/api/chauffeurs/fleet-owner-chauffeurs.server", () => ({
  getFleetOwnerChauffeurs,
  inviteFleetOwnerChauffeur,
  updateFleetOwnerChauffeur,
}));

import { ApiRequestError } from "~/api/api.server";
import type { FleetOwnerOnboarding } from "~/api/fleet/onboarding/schema";
import { HTTP_STATUS } from "~/api/http-status";
import type { FleetOwnerRequestContext } from "~/fleet/fleet-owner-context";
import { fleetOwnerContext } from "~/fleet/fleet-owner-context";
import type { Route } from "./+types/fleet-owner.chauffeurs";
import { action, headers, loader, shouldRevalidate } from "./fleet-owner.chauffeurs";

const IDEMPOTENCY_KEY = "18aa029c-4bb1-4ca7-b25e-cfc802c4bf8c";
const FRESH_IDEMPOTENCY_KEY = "9c4e2a71-6d3f-4b18-a5e2-7f1c0d8e4b92";
const PATH = "/fleet-owner/chauffeurs";

const chauffeur = {
  id: "invite-1",
  chauffeurId: "chauffeur-1",
  name: "Bola Adebayo",
  email: "bola@example.com",
  phoneNumber: "+2348012345678",
  status: "APPROVED" as const,
  isActive: true,
  image: null,
  invitedAt: "2026-08-20T12:00:00.000Z",
};

const complianceRequirements = [{ type: "LASDRI" as const, label: "LASDRI card", required: false }];

function verifiedOnboarding(isOwnerDriver: boolean): FleetOwnerOnboarding {
  return {
    status: "VERIFIED",
    accountType: "INDIVIDUAL",
    isOwnerDriver,
    emailVerified: true,
    phone: { number: "**********5678", verified: true },
    identity: { status: "SUCCEEDED", legalName: "JOHN DOE", businessName: null },
    bank: {
      bankName: "GTBank",
      accountName: "JOHN DOE",
      accountNumber: "******6789",
      verified: true,
    },
    documents: { driversLicense: null, lasdri: null },
    requiredActions: [],
    steps: {
      contact: "VERIFIED",
      identity: "VERIFIED",
      payout: "VERIFIED",
      driving: isOwnerDriver ? "COMPLETED" : "SKIPPED",
      submission: "VERIFIED",
    },
    nextAction: "COMPLETE",
  };
}

function fleetContext(isOwnerDriver: boolean): FleetOwnerRequestContext {
  return {
    user: {
      id: "owner-1",
      email: "owner@example.com",
      name: "Fleet Owner",
      roles: ["fleetOwner"],
    },
    onboarding: verifiedOnboarding(isOwnerDriver),
  };
}

function routeArgs(request: Request, isOwnerDriver = false): Route.LoaderArgs {
  const context = new RouterContextProvider();
  context.set(fleetOwnerContext, fleetContext(isOwnerDriver));
  return {
    request,
    url: new URL(request.url),
    pattern: PATH,
    params: {},
    context,
  };
}

function actionArgs(
  fields: Record<string, string>,
  url = `https://tripdly.com${PATH}`,
  isOwnerDriver = false,
): Route.ActionArgs {
  const body = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    body.set(name, value);
  }
  return routeArgs(new Request(url, { method: "POST", body }), isOwnerDriver);
}

function apiError(
  status: number,
  detail: string,
  retryAfter?: string,
  kind: ApiRequestError["kind"] = "http",
) {
  return new ApiRequestError(
    kind,
    status,
    {
      type: "FLEET_OWNER_CHAUFFEUR_ERROR",
      title: "Chauffeur error",
      status,
      detail,
    },
    retryAfter ? new Headers({ "Retry-After": retryAfter }) : undefined,
  );
}

function inviteFields(overrides: Record<string, string> = {}) {
  return {
    intent: "invite",
    name: "Bola Adebayo",
    email: "bola@example.com",
    phoneNumber: "+2348012345678",
    idempotencyKey: IDEMPOTENCY_KEY,
    ...overrides,
  };
}

function expectRedirect(result: unknown, location: string) {
  expect(result).toBeInstanceOf(Response);
  if (!(result instanceof Response)) {
    throw new Error("Expected a redirect response");
  }
  expect(result.status).toBe(302);
  expect(result.headers.get("location")).toBe(location);
}

describe("fleet-owner chauffeurs route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getFleetOwnerChauffeurs.mockResolvedValue({
      data: {
        items: [chauffeur],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
        complianceRequirements,
      },
    });
    inviteFleetOwnerChauffeur.mockResolvedValue({ data: chauffeur });
    updateFleetOwnerChauffeur.mockResolvedValue({ data: chauffeur });
  });

  it("returns private no-store headers from the route", () => {
    expect(headers()).toEqual({ "Cache-Control": "private, no-store" });
  });

  it("loads chauffeurs with the parsed page and API page size", async () => {
    const uuid = vi.spyOn(crypto, "randomUUID").mockReturnValue(IDEMPOTENCY_KEY);
    const request = new Request(`https://tripdly.com${PATH}?page=1`);

    const result = await loader(routeArgs(request));

    expect(getFleetOwnerChauffeurs).toHaveBeenCalledWith({
      request,
      searchParams: new URLSearchParams({ page: "1", limit: "20" }),
    });
    expect(result).toMatchObject({
      chauffeurs: [chauffeur],
      complianceRequirements,
      idempotencyKey: IDEMPOTENCY_KEY,
      isOwnerDriver: false,
      page: 1,
      total: 1,
      totalPages: 1,
    });
    uuid.mockRestore();
  });

  it("marks owner-driver accounts from the parent onboarding context", async () => {
    const request = new Request(`https://tripdly.com${PATH}`);

    const result = await loader(routeArgs(request, true));

    expect(result).toMatchObject({ isOwnerDriver: true });
  });

  it("redirects an out-of-range page to the last available page", async () => {
    getFleetOwnerChauffeurs.mockResolvedValueOnce({
      data: {
        items: [],
        meta: { page: 9, limit: 20, total: 21, totalPages: 2 },
        complianceRequirements,
      },
    });

    const result = await loader(routeArgs(new Request(`https://tripdly.com${PATH}?page=9`))).catch(
      (error: unknown) => error,
    );

    expectRedirect(result, `${PATH}?page=2`);
  });

  it("invites a chauffeur and redirects to the list", async () => {
    const args = actionArgs({
      intent: "invite",
      name: "  Bola Adebayo  ",
      email: " Bola@Example.com ",
      phoneNumber: "+2348012345678",
      idempotencyKey: IDEMPOTENCY_KEY,
    });

    const result = await action(args);

    expect(inviteFleetOwnerChauffeur).toHaveBeenCalledWith({
      request: args.request,
      idempotencyKey: IDEMPOTENCY_KEY,
      body: {
        name: "Bola Adebayo",
        email: "bola@example.com",
        phoneNumber: "+2348012345678",
      },
    });
    expectRedirect(result, PATH);
  });

  it("rejects an owner-driver invitation without calling the API", async () => {
    const result = await action(
      actionArgs(
        {
          intent: "invite",
          name: "Bola Adebayo",
          email: "bola@example.com",
          phoneNumber: "+2348012345678",
          idempotencyKey: IDEMPOTENCY_KEY,
        },
        `https://tripdly.com${PATH}`,
        true,
      ),
    );

    expect(inviteFleetOwnerChauffeur).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      data: {
        intent: "invite",
        idempotencyKey: IDEMPOTENCY_KEY,
        error: "Owner-driver accounts cannot invite another chauffeur.",
        revalidate: false,
      },
      init: { status: HTTP_STATUS.FORBIDDEN },
    });
  });

  it("keeps the invite idempotency key after local validation errors", async () => {
    const invalid = await action(
      actionArgs(
        inviteFields({
          name: "A",
          email: "not-an-email",
          phoneNumber: "08012345678",
        }),
      ),
    );

    expect(inviteFleetOwnerChauffeur).not.toHaveBeenCalled();
    expect(invalid).toMatchObject({
      data: { intent: "invite", idempotencyKey: IDEMPOTENCY_KEY, revalidate: false },
      init: { status: HTTP_STATUS.BAD_REQUEST },
    });
  });

  it.each([
    ["network", HTTP_STATUS.SERVICE_UNAVAILABLE],
    ["timeout", HTTP_STATUS.GATEWAY_TIMEOUT],
  ] as const)("keeps the invite idempotency key after a %s error", async (kind, status) => {
    inviteFleetOwnerChauffeur.mockRejectedValueOnce(
      apiError(status, "upstream unavailable", undefined, kind),
    );
    const uuid = vi.spyOn(crypto, "randomUUID").mockReturnValue(FRESH_IDEMPOTENCY_KEY);

    try {
      const result = await action(actionArgs(inviteFields()));

      expect(result).toMatchObject({
        data: {
          intent: "invite",
          idempotencyKey: IDEMPOTENCY_KEY,
          error: "Unable to send the invitation. Please try again.",
          revalidate: false,
        },
        init: { status },
      });
      expect(uuid).not.toHaveBeenCalled();
    } finally {
      uuid.mockRestore();
    }
  });

  it("keeps the invite idempotency key after an API error with Retry-After", async () => {
    inviteFleetOwnerChauffeur.mockRejectedValueOnce(
      apiError(HTTP_STATUS.TOO_MANY_REQUESTS, "Try again later.", "30"),
    );
    const uuid = vi.spyOn(crypto, "randomUUID").mockReturnValue(FRESH_IDEMPOTENCY_KEY);

    try {
      const result = await action(actionArgs(inviteFields()));

      expect(result).toMatchObject({
        data: {
          intent: "invite",
          idempotencyKey: IDEMPOTENCY_KEY,
          error: "Try again later.",
          revalidate: false,
        },
        init: { status: HTTP_STATUS.TOO_MANY_REQUESTS },
      });
      expect(uuid).not.toHaveBeenCalled();
    } finally {
      uuid.mockRestore();
    }
  });

  it("issues a fresh invite idempotency key after a definitive HTTP error", async () => {
    inviteFleetOwnerChauffeur.mockRejectedValueOnce(
      apiError(HTTP_STATUS.CONFLICT, "This chauffeur is already invited."),
    );
    const uuid = vi.spyOn(crypto, "randomUUID").mockReturnValue(FRESH_IDEMPOTENCY_KEY);

    try {
      const result = await action(actionArgs(inviteFields()));

      expect(result).toMatchObject({
        data: {
          intent: "invite",
          idempotencyKey: FRESH_IDEMPOTENCY_KEY,
          error: "This chauffeur is already invited.",
          revalidate: false,
        },
        init: { status: HTTP_STATUS.CONFLICT },
      });
      expect(uuid).toHaveBeenCalledOnce();
    } finally {
      uuid.mockRestore();
    }
  });

  it("updates chauffeur activation through the mocked API adapter", async () => {
    const args = actionArgs({
      intent: "update",
      chauffeurId: "chauffeur-1",
      isActive: "false",
    });

    const result = await action(args);

    expect(updateFleetOwnerChauffeur).toHaveBeenCalledWith({
      request: args.request,
      chauffeurId: "chauffeur-1",
      isActive: false,
    });
    expect(result).toMatchObject({
      data: { intent: "update", chauffeurId: "chauffeur-1" },
    });
  });

  it("hides 5xx details behind a generic update retry and keeps the chauffeur id", async () => {
    updateFleetOwnerChauffeur.mockRejectedValueOnce(
      apiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, "database exploded"),
    );

    const result = await action(
      actionArgs({
        intent: "update",
        chauffeurId: "chauffeur-1",
        isActive: "false",
      }),
    );

    expect(result).toMatchObject({
      data: {
        intent: "update",
        chauffeurId: "chauffeur-1",
        error: "Unable to update this chauffeur. Please try again.",
        revalidate: false,
      },
      init: { status: HTTP_STATUS.INTERNAL_SERVER_ERROR },
    });
    expect(JSON.stringify(result)).not.toContain("database exploded");
  });

  it("rejects an invalid activation payload without calling the API", async () => {
    const result = await action(
      actionArgs({ intent: "update", chauffeurId: "", isActive: "maybe" }),
    );

    expect(updateFleetOwnerChauffeur).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      data: {
        intent: "update",
        error: "This chauffeur could not be updated.",
        revalidate: false,
      },
      init: { status: HTTP_STATUS.BAD_REQUEST },
    });
  });

  it("does not reload when opening the invite sheet on the same page", () => {
    expect(
      shouldRevalidate({
        currentUrl: new URL(`https://tripdly.com${PATH}`),
        nextUrl: new URL(`https://tripdly.com${PATH}?invite=1`),
        defaultShouldRevalidate: true,
      } as Parameters<typeof shouldRevalidate>[0]),
    ).toBe(false);
    expect(
      shouldRevalidate({
        actionResult: { revalidate: false },
        defaultShouldRevalidate: true,
      } as Parameters<typeof shouldRevalidate>[0]),
    ).toBe(false);
    expect(
      shouldRevalidate({
        currentUrl: new URL(`https://tripdly.com${PATH}`),
        nextUrl: new URL(`https://tripdly.com${PATH}?page=2`),
        formMethod: "GET",
        defaultShouldRevalidate: true,
      } as Parameters<typeof shouldRevalidate>[0]),
    ).toBe(true);
  });
});
