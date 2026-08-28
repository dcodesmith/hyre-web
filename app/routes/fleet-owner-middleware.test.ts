import { RouterContextProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";

const { requireFleetOwner } = vi.hoisted(() => ({
  requireFleetOwner: vi.fn(),
}));

vi.mock("~/auth/fleet-owner-session.server", () => ({ requireFleetOwner }));

import { loader, middleware, shouldRevalidate } from "./fleet-owner";

describe("fleet-owner route middleware", () => {
  it("loads the fleet-owner session once and shares it with the parent loader", async () => {
    const user = {
      id: "owner-1",
      email: "owner@example.com",
      name: "Fleet Owner",
      roles: ["fleetOwner"],
    };
    const request = new Request("https://tripdly.com/fleet-owner/cars");
    const context = new RouterContextProvider();
    requireFleetOwner.mockResolvedValue(user);

    await middleware[0]({ request, context, params: {} } as never, async () => new Response());
    const result = loader({ request, context, params: {} } as never);

    expect(requireFleetOwner).toHaveBeenCalledOnce();
    expect(result).toEqual({ user });
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
