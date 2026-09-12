import { RouterContextProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { endAdminAddonPrice } = vi.hoisted(() => ({
  endAdminAddonPrice: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({
  env: { API_ORIGIN: "https://api.invalid" },
}));
vi.mock("~/api/admin/addons/addons.server", () => ({
  createAdminAddon: vi.fn(),
  createAdminAddonPrice: vi.fn(),
  endAdminAddonPrice,
  getAdminAddons: vi.fn(),
  updateAdminAddon: vi.fn(),
}));

import { ApiRequestError } from "~/api/api.server";
import { HTTP_STATUS } from "~/api/http-status";
import type { Route } from "./+types/admin.addon-rates";
import { action, shouldRevalidate } from "./admin.addon-rates";

const ADDON_ID = "cmaddonprotocol0000000001";
const PRICE_ID = "cmaddonprice0000000000001";

function actionArgs(form: Record<string, string>): Route.ActionArgs {
  const body = new FormData();
  for (const [name, value] of Object.entries(form)) {
    body.set(name, value);
  }

  return {
    request: new Request("https://tripdly.com/admin/addon-rates", { method: "POST", body }),
    url: new URL("https://tripdly.com/admin/addon-rates"),
    pattern: "/admin/addon-rates",
    params: {},
    context: new RouterContextProvider(),
  };
}

describe("admin add-on rates route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the API detail when ending a price fails and skips revalidation", async () => {
    endAdminAddonPrice.mockRejectedValue(
      new ApiRequestError("http", HTTP_STATUS.CONFLICT, {
        type: "https://api.tripdly.com/problems/addon-price-cannot-end",
        title: "Add-on Price Cannot End",
        status: HTTP_STATUS.CONFLICT,
        detail: "This add-on price has already ended",
        errorCode: "ADDON_PRICE_CANNOT_END",
      }),
    );

    const result = await action(
      actionArgs({ intent: "end-price", addonId: ADDON_ID, priceId: PRICE_ID }),
    );

    expect(result).toMatchObject({
      data: {
        intent: "end-price",
        error: "This add-on price has already ended",
        revalidate: false,
      },
      init: { status: HTTP_STATUS.CONFLICT },
    });
    expect(
      shouldRevalidate({
        actionResult: result.data,
        defaultShouldRevalidate: true,
      } as Parameters<typeof shouldRevalidate>[0]),
    ).toBe(false);
  });

  it("rejects an invalid price id before calling the API", async () => {
    const result = await action(
      actionArgs({ intent: "end-price", addonId: ADDON_ID, priceId: "price-1" }),
    );

    expect(endAdminAddonPrice).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      data: { intent: "end-price", error: "This price cannot be ended.", revalidate: false },
      init: { status: HTTP_STATUS.BAD_REQUEST },
    });
  });
});
