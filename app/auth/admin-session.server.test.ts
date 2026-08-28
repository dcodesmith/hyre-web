import { beforeEach, describe, expect, it, vi } from "vitest";

const { readAuthSessionUser } = vi.hoisted(() => ({
  readAuthSessionUser: vi.fn(),
}));

vi.mock("~/auth/session.server", () => ({ readAuthSessionUser }));

import { redirectAuthenticatedAdmin, requireAdminOrStaff } from "./admin-session.server";

describe("admin session guards", () => {
  beforeEach(() => {
    readAuthSessionUser.mockReset();
  });

  it("redirects guests to the admin login and preserves the protected URL", async () => {
    readAuthSessionUser.mockResolvedValue(null);
    const request = new Request("https://tripdly.com/admin/cars?approvalStatus=PENDING");

    const response = await requireAdminOrStaff(request).catch((error: unknown) => error);

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get("location")).toBe(
      "/admin/login?redirectTo=%2Fadmin%2Fcars%3FapprovalStatus%3DPENDING",
    );
  });

  it("allows staff and reports the effective portal role", async () => {
    const user = {
      id: "staff-1",
      email: "staff@example.com",
      name: "Staff User",
      roles: ["staff"],
    };
    readAuthSessionUser.mockResolvedValue(user);

    await expect(requireAdminOrStaff(new Request("https://tripdly.com/admin"))).resolves.toEqual({
      role: "staff",
      user,
    });
  });

  it("prefers admin when an account has both portal roles", async () => {
    readAuthSessionUser.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
      name: "Admin User",
      roles: ["staff", "admin"],
    });

    await expect(
      requireAdminOrStaff(new Request("https://tripdly.com/admin")),
    ).resolves.toMatchObject({ role: "admin" });
  });

  it("returns forbidden for authenticated non-portal users", async () => {
    readAuthSessionUser.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      name: "Customer",
      roles: ["user"],
    });

    const response = await requireAdminOrStaff(new Request("https://tripdly.com/admin")).catch(
      (error: unknown) => error,
    );

    expect((response as { init?: ResponseInit }).init?.status).toBe(403);
  });

  it("redirects an authenticated admin away from login", async () => {
    readAuthSessionUser.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
      name: "Admin User",
      roles: ["admin"],
    });

    const response = await redirectAuthenticatedAdmin(
      new Request("https://tripdly.com/admin/login?redirectTo=%2Fadmin%2Fcars"),
    ).catch((error: unknown) => error);

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get("location")).toBe("/admin/cars");
  });
});
