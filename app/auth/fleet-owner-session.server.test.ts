import { beforeEach, describe, expect, it, vi } from "vitest";

const { readAuthSessionUser } = vi.hoisted(() => ({
  readAuthSessionUser: vi.fn(),
}));

vi.mock("~/auth/session.server", () => ({ readAuthSessionUser }));

import { redirectAuthenticatedFleetOwner, requireFleetOwner } from "./fleet-owner-session.server";

const fleetOwner = {
  id: "owner-1",
  email: "owner@example.com",
  name: "Fleet Owner",
  roles: ["fleetOwner"],
};

describe("fleet-owner session guards", () => {
  beforeEach(() => {
    readAuthSessionUser.mockReset();
  });

  it("keeps the fleet login page open for guests", async () => {
    readAuthSessionUser.mockResolvedValue(null);

    await expect(
      redirectAuthenticatedFleetOwner(new Request("https://tripdly.com/fleet-owner/login")),
    ).resolves.toBeUndefined();
  });

  it("redirects signed-in fleet owners to a safe fleet route", async () => {
    readAuthSessionUser.mockResolvedValue(fleetOwner);

    const response = await redirectAuthenticatedFleetOwner(
      new Request("https://tripdly.com/fleet-owner/login?redirectTo=%2Ffleet-owner%2Fcars"),
    ).catch((error: unknown) => error);

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get("location")).toBe("/fleet-owner/cars");
  });

  it("redirects other signed-in roles away from fleet login", async () => {
    readAuthSessionUser.mockResolvedValue({ ...fleetOwner, roles: ["user"] });

    const response = await redirectAuthenticatedFleetOwner(
      new Request("https://tripdly.com/fleet-owner/login"),
    ).catch((error: unknown) => error);

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get("location")).toBe("/");
  });

  it("preserves a protected fleet URL when sending guests to login", async () => {
    readAuthSessionUser.mockResolvedValue(null);

    const response = await requireFleetOwner(
      new Request("https://tripdly.com/fleet-owner/cars?status=AVAILABLE"),
    ).catch((error: unknown) => error);

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get("location")).toBe(
      "/fleet-owner/login?redirectTo=%2Ffleet-owner%2Fcars%3Fstatus%3DAVAILABLE",
    );
  });

  it("returns the API session user only for the fleet-owner role", async () => {
    readAuthSessionUser.mockResolvedValue(fleetOwner);
    await expect(requireFleetOwner(new Request("https://tripdly.com/fleet-owner"))).resolves.toBe(
      fleetOwner,
    );

    readAuthSessionUser.mockResolvedValue({ ...fleetOwner, roles: ["user"] });
    await expect(
      requireFleetOwner(new Request("https://tripdly.com/fleet-owner")),
    ).rejects.toMatchObject({ init: { status: 403 } });
  });
});
