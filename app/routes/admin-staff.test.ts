import { RouterContextProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAdminStaff, getAdminStaff, reinstateAdminStaff, revokeAdminStaff } = vi.hoisted(
  () => ({
    createAdminStaff: vi.fn(),
    getAdminStaff: vi.fn(),
    reinstateAdminStaff: vi.fn(),
    revokeAdminStaff: vi.fn(),
  }),
);

vi.mock("cloudflare:workers", () => ({
  env: { API_ORIGIN: "https://api.invalid" },
}));
vi.mock("~/api/admin/staff/staff.server", () => ({
  createAdminStaff,
  getAdminStaff,
  reinstateAdminStaff,
  revokeAdminStaff,
}));

import { ApiRequestError } from "~/api/api.server";
import { HTTP_STATUS } from "~/api/http-status";
import type { Route } from "./+types/admin.staff";
import { action, loader } from "./admin.staff";

const STAFF_ID = "cm62345678901234567890123";

function loaderArgs(request: Request): Route.LoaderArgs {
  return {
    request,
    url: new URL(request.url),
    pattern: "/admin/staff",
    params: {},
    context: new RouterContextProvider(),
  };
}

function actionArgs(
  form: Record<string, string>,
  url = "https://tripdly.com/admin/staff",
): Route.ActionArgs {
  const body = new FormData();
  for (const [name, value] of Object.entries(form)) {
    body.set(name, value);
  }

  return {
    request: new Request(url, { method: "POST", body }),
    url: new URL(url),
    pattern: "/admin/staff",
    params: {},
    context: new RouterContextProvider(),
  };
}

describe("admin staff route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads staff with the parsed status, page, and limit", async () => {
    getAdminStaff.mockResolvedValue({
      data: {
        staff: [],
        meta: { page: 2, limit: 50, total: 0, totalPages: 0 },
      },
    });
    const request = new Request("https://tripdly.com/admin/staff?status=revoked&page=2&limit=50");

    const result = await loader(loaderArgs(request));

    expect(getAdminStaff).toHaveBeenCalledWith({
      request,
      status: "revoked",
      page: 2,
      limit: 50,
    });
    expect(result).toMatchObject({
      staff: [],
      query: { status: "revoked", page: 2, limit: 50 },
    });
  });

  it("defaults list query params when they are omitted", async () => {
    getAdminStaff.mockResolvedValue({
      data: {
        staff: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      },
    });
    const request = new Request("https://tripdly.com/admin/staff");

    const result = await loader(loaderArgs(request));

    expect(getAdminStaff).toHaveBeenCalledWith({
      request,
      page: 1,
      limit: 20,
    });
    expect(result.query).toEqual({ page: 1, limit: 20 });
  });

  it("redirects an out-of-range page to the final available page", async () => {
    getAdminStaff.mockResolvedValue({
      data: {
        staff: [],
        meta: { page: 999, limit: 20, total: 22, totalPages: 2 },
      },
    });
    const request = new Request("https://tripdly.com/admin/staff?status=active&page=999");

    const response = await loader(loaderArgs(request)).catch((error) => error);

    expect(response).toBeInstanceOf(Response);
    if (!(response instanceof Response)) {
      throw new Error("Expected a redirect response");
    }
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/admin/staff?status=active&page=2");
  });

  it("rejects invalid input before calling the API", async () => {
    const result = await action(
      actionArgs({ intent: "create", name: "A", email: "not-an-email", phoneNumber: "123" }),
    );

    expect(createAdminStaff).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      init: { status: HTTP_STATUS.BAD_REQUEST },
    });
  });

  it("creates staff with the validated body", async () => {
    createAdminStaff.mockResolvedValue({
      data: {
        id: "staff-1",
        name: "Ada Lovelace",
        email: "ada@example.com",
        phoneNumber: "08012345678",
        createdAt: "2026-08-31T10:00:00.000Z",
      },
    });

    const result = await action(
      actionArgs(
        {
          intent: "create",
          name: "  Ada Lovelace  ",
          email: " Ada@Example.com ",
          phoneNumber: "  08012345678  ",
        },
        "https://tripdly.com/admin/staff?status=active&add=1",
      ),
    );

    expect(createAdminStaff).toHaveBeenCalledWith({
      request: expect.any(Request),
      body: {
        name: "Ada Lovelace",
        email: "ada@example.com",
        phoneNumber: "08012345678",
      },
    });
    expect(result).toBeInstanceOf(Response);
    if (!(result instanceof Response)) {
      throw new Error("Expected a redirect response");
    }
    expect(result.status).toBe(302);
    expect(result.headers.get("location")).toBe("/admin/staff?status=active");
  });

  it("keeps the add dialog open after create-more", async () => {
    createAdminStaff.mockResolvedValue({
      data: {
        id: "staff-1",
        name: "Ada Lovelace",
        email: "ada@example.com",
        phoneNumber: "08012345678",
        createdAt: "2026-08-31T10:00:00.000Z",
      },
    });

    const result = await action(
      actionArgs({
        intent: "create-more",
        name: "Ada Lovelace",
        email: "ada@example.com",
        phoneNumber: "08012345678",
      }),
    );

    expect(result).toMatchObject({
      data: { intent: "create-more", success: "Staff member added." },
    });
  });

  it("surfaces a staff role conflict from the API", async () => {
    createAdminStaff.mockRejectedValue(
      new ApiRequestError("http", HTTP_STATUS.CONFLICT, {
        type: "USERS_STAFF_ROLE_CONFLICT",
        title: "Staff role conflict",
        status: HTTP_STATUS.CONFLICT,
        detail: "Staff cannot also be an admin, fleet owner, or chauffeur",
      }),
    );

    const result = await action(
      actionArgs({
        intent: "create",
        name: "Ada Lovelace",
        email: "ada@example.com",
        phoneNumber: "08012345678",
      }),
    );

    expect(result).toMatchObject({
      data: { error: "Staff cannot also be an admin, fleet owner, or chauffeur" },
      init: { status: HTTP_STATUS.CONFLICT },
    });
  });

  it("revokes staff by id", async () => {
    revokeAdminStaff.mockResolvedValue({
      data: {
        id: STAFF_ID,
        name: "Ada Lovelace",
        email: "ada@example.com",
        phoneNumber: "08012345678",
        createdAt: "2026-08-31T10:00:00.000Z",
        status: "revoked",
        revokedAt: "2026-09-01T10:00:00.000Z",
      },
    });

    const result = await action(actionArgs({ intent: "revoke", staffId: STAFF_ID }));

    expect(revokeAdminStaff).toHaveBeenCalledWith(expect.any(Request), STAFF_ID);
    expect(result).toMatchObject({
      data: { intent: "revoke" },
    });
    expect(result).not.toMatchObject({
      data: { success: expect.any(String) },
    });
  });

  it("reinstates staff by id", async () => {
    reinstateAdminStaff.mockResolvedValue({
      data: {
        id: STAFF_ID,
        name: "Ada Lovelace",
        email: "ada@example.com",
        phoneNumber: "08012345678",
        createdAt: "2026-08-31T10:00:00.000Z",
        status: "active",
        revokedAt: null,
      },
    });

    const result = await action(actionArgs({ intent: "reinstate", staffId: STAFF_ID }));

    expect(reinstateAdminStaff).toHaveBeenCalledWith(expect.any(Request), STAFF_ID);
    expect(result).toMatchObject({
      data: { intent: "reinstate" },
    });
    expect(result).not.toMatchObject({
      data: { success: expect.any(String) },
    });
  });

  it("rejects an invalid staff id before calling the API", async () => {
    const result = await action(actionArgs({ intent: "revoke", staffId: "not-a-cuid" }));

    expect(revokeAdminStaff).not.toHaveBeenCalled();
    expect(reinstateAdminStaff).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      data: { intent: "revoke", error: "This staff member could not be identified." },
      init: { status: HTTP_STATUS.BAD_REQUEST },
    });
  });
});
