import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const router = {
  searchParams: new URLSearchParams(),
  navigation: {
    state: "idle",
    location: undefined as { search: string } | undefined,
  },
};

vi.mock("react-router", () => ({
  useNavigation: () => router.navigation,
  useSearchParams: () => [router.searchParams, vi.fn()],
}));

import { useSearchJourneyUrl } from "~/hooks/use-search-journey-url";

const SEARCH_ID = "01994a1d-4263-7000-8000-000000000010";
const URL_SEARCH_ID = "01994a1d-4263-7000-8000-000000000011";

function Probe({ searchId }: { readonly searchId?: string }) {
  return createElement("span", null, useSearchJourneyUrl(searchId).toString());
}

function renderSearch(search: string, state: "idle" | "loading", pendingSearch?: string) {
  router.searchParams = new URLSearchParams(search);
  router.navigation = {
    state,
    location: pendingSearch === undefined ? undefined : { search: pendingSearch },
  };
  return renderToStaticMarkup(createElement(Probe, { searchId: SEARCH_ID }));
}

describe("useSearchJourneyUrl", () => {
  it("makes the result journey available before the URL effect runs", () => {
    expect(renderSearch("bookingType=DAY", "idle")).toContain(`searchId=${SEARCH_ID}`);
  });

  it("does not apply a stale result journey during a new navigation", () => {
    expect(renderSearch("bookingType=DAY", "loading", "?bookingType=NIGHT")).not.toContain(
      "searchId",
    );
  });

  it("preserves a valid journey supplied by an ID-only navigation", () => {
    const markup = renderSearch(`bookingType=DAY&searchId=${URL_SEARCH_ID}`, "idle");

    expect(markup).toContain(`searchId=${URL_SEARCH_ID}`);
    expect(markup).not.toContain(`searchId=${SEARCH_ID}`);
  });

  it("replaces an invalid URL journey with the result journey", () => {
    const markup = renderSearch("bookingType=DAY&searchId=invalid", "idle");

    expect(markup).toContain(`searchId=${SEARCH_ID}`);
    expect(markup).not.toContain("searchId=invalid");
  });

  it("keeps the journey available while its own URL synchronization is loading", () => {
    expect(
      renderSearch("bookingType=DAY", "loading", `?bookingType=DAY&searchId=${SEARCH_ID}`),
    ).toContain(`searchId=${SEARCH_ID}`);
  });
});
