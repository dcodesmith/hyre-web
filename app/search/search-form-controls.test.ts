import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const navigationState = {
  state: "idle" as "idle" | "loading",
  location: undefined as { pathname: string } | undefined,
};

vi.mock("react-router", () => ({
  useNavigation: () => navigationState,
}));

import { SearchButton } from "~/search/search-form-controls";

describe("SearchButton", () => {
  it("shows Search when navigation is idle", () => {
    navigationState.state = "idle";
    navigationState.location = undefined;

    const markup = renderToStaticMarkup(createElement(SearchButton, { isCompact: false }));

    expect(markup).toContain("Search");
    expect(markup).not.toContain("Searching");
    expect(markup).not.toContain('disabled=""');
  });

  it("shows Searching and disables submit while navigating to /search", () => {
    navigationState.state = "loading";
    navigationState.location = { pathname: "/search" };

    const markup = renderToStaticMarkup(createElement(SearchButton, { isCompact: true }));

    expect(markup).toContain("Searching…");
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('aria-label="Searching"');
  });
});
