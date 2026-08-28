import { RouterContextProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireAdminOrStaff } = vi.hoisted(() => ({
  requireAdminOrStaff: vi.fn(),
}));

vi.mock("~/auth/admin-session.server", () => ({ requireAdminOrStaff }));

import { requireAdminContext } from "~/auth/admin-context.server";
import type { Route } from "./+types/admin";
import { loader, middleware } from "./admin";

describe("admin route middleware", () => {
  beforeEach(() => {
    requireAdminOrStaff.mockReset();
  });

  it("loads the portal session once and shares it with the parent loader", async () => {
    const session = {
      role: "staff",
      user: {
        id: "staff-1",
        email: "staff@example.com",
        name: "Staff User",
        roles: ["staff"],
      },
    };
    const request = new Request("https://tripdly.com/admin");
    const context = new RouterContextProvider();
    requireAdminOrStaff.mockResolvedValue(session);
    const routeArgs: Route.LoaderArgs = {
      request,
      context,
      params: {},
      url: new URL(request.url),
      pattern: "/admin",
    };

    await middleware[0](routeArgs, async () => new Response());
    const result = await loader(routeArgs);

    expect(requireAdminOrStaff).toHaveBeenCalledOnce();
    expect(result).toEqual(session);
  });

  it("blocks staff from admin-only child routes without loading the session twice", async () => {
    const request = new Request("https://tripdly.com/admin/fees");
    const context = new RouterContextProvider();
    requireAdminOrStaff.mockResolvedValue({
      role: "staff",
      user: {
        id: "staff-1",
        email: "staff@example.com",
        name: "Staff User",
        roles: ["staff"],
      },
    });
    const routeArgs: Route.LoaderArgs = {
      request,
      context,
      params: {},
      url: new URL(request.url),
      pattern: "/admin",
    };

    await middleware[0](routeArgs, async () => new Response());
    const response = await Promise.resolve()
      .then(() => requireAdminContext(context))
      .catch((error: unknown) => error);

    expect((response as { init?: ResponseInit }).init?.status).toBe(403);
    expect(requireAdminOrStaff).toHaveBeenCalledOnce();
  });
});
