import { RouterContextProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";

const { requireAdminOrStaff } = vi.hoisted(() => ({
  requireAdminOrStaff: vi.fn(),
}));

vi.mock("~/auth/admin-session.server", () => ({ requireAdminOrStaff }));

import { loader, middleware } from "./admin";

describe("admin route middleware", () => {
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
    const routeArgs = { request, context, params: {} };

    await middleware[0](routeArgs, async () => new Response());
    const result = loader(routeArgs);

    expect(requireAdminOrStaff).toHaveBeenCalledOnce();
    expect(result).toEqual(session);
  });
});
