import { RouterContextProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getFleetOwnerOnboarding, requireFleetOwner } = vi.hoisted(() => ({
  getFleetOwnerOnboarding: vi.fn(),
  requireFleetOwner: vi.fn(),
}));

vi.mock("~/auth/fleet-owner-session.server", () => ({ requireFleetOwner }));
vi.mock("~/api/fleet/onboarding/onboarding.server", () => ({ getFleetOwnerOnboarding }));

import { loader, middleware, shouldRevalidate } from "./fleet-owner";

const user = {
  id: "owner-1",
  email: "owner@example.com",
  name: "Fleet Owner",
  roles: ["fleetOwner"],
};

function onboarding(status: "ACTION_REQUIRED" | "UNDER_REVIEW" | "VERIFIED") {
  return {
    status,
    accountType: null,
    isOwnerDriver: false,
    emailVerified: true,
    phone: { number: null, verified: false },
    identity: null,
    bank: null,
    documents: { driversLicense: null, lasdri: null },
    requiredActions: [],
  };
}

async function runParentLoader(
  url: string,
  status: "ACTION_REQUIRED" | "UNDER_REVIEW" | "VERIFIED",
) {
  const request = new Request(url);
  const context = new RouterContextProvider();
  const data = onboarding(status);
  requireFleetOwner.mockResolvedValue(user);
  getFleetOwnerOnboarding.mockResolvedValue({ data });

  for (const fn of middleware) {
    await fn({ request, context, params: {} } as never, async () => new Response());
  }

  const result = await Promise.resolve()
    .then(() => loader({ request, context, params: {} } as never))
    .catch((error: unknown) => error);

  return { request, result, onboarding: data };
}

describe("fleet-owner route middleware", () => {
  beforeEach(() => {
    requireFleetOwner.mockReset();
    getFleetOwnerOnboarding.mockReset();
  });

  it("loads the session and onboarding once, then shares both with the parent loader", async () => {
    const {
      request,
      result,
      onboarding: data,
    } = await runParentLoader("https://tripdly.com/fleet-owner/cars", "VERIFIED");

    expect(requireFleetOwner).toHaveBeenCalledOnce();
    expect(requireFleetOwner).toHaveBeenCalledWith(request);
    expect(getFleetOwnerOnboarding).toHaveBeenCalledOnce();
    expect(getFleetOwnerOnboarding).toHaveBeenCalledWith({ request });
    expect(requireFleetOwner.mock.invocationCallOrder[0]).toBeLessThan(
      getFleetOwnerOnboarding.mock.invocationCallOrder[0],
    );
    expect(result).toEqual({ user, onboarding: data });
  });

  it.each([
    ["ACTION_REQUIRED", "https://tripdly.com/fleet-owner/cars"],
    ["UNDER_REVIEW", "https://tripdly.com/fleet-owner"],
  ] as const)("redirects %s owners from protected fleet paths", async (status, url) => {
    const { result } = await runParentLoader(url, status);

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(302);
    expect((result as Response).headers.get("location")).toBe("/fleet-owner/onboarding");
    expect(requireFleetOwner).toHaveBeenCalledOnce();
    expect(getFleetOwnerOnboarding).toHaveBeenCalledOnce();
  });

  it("lets non-verified owners stay on onboarding", async () => {
    const { result, onboarding: data } = await runParentLoader(
      "https://tripdly.com/fleet-owner/onboarding",
      "ACTION_REQUIRED",
    );

    expect(result).toEqual({ user, onboarding: data });
  });

  it("redirects verified owners away from onboarding", async () => {
    const { result } = await runParentLoader(
      "https://tripdly.com/fleet-owner/onboarding",
      "VERIFIED",
    );

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(302);
    expect((result as Response).headers.get("location")).toBe("/fleet-owner");
  });

  it("does not reload the session for same-page table URL state changes", () => {
    expect(
      shouldRevalidate({
        currentUrl: new URL("https://tripdly.com/fleet-owner/cars"),
        nextUrl: new URL("https://tripdly.com/fleet-owner/cars?filter.make=Lexus"),
        defaultShouldRevalidate: true,
      } as never),
    ).toBe(false);
  });
});
