import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetcher = vi.hoisted(() => ({
  state: "idle" as "idle" | "loading" | "submitting",
  data: undefined as
    | {
        availableCredits: number;
        maxCreditsPerBooking: number;
        error: string | null;
      }
    | undefined,
  load: vi.fn(),
}));

vi.mock("react-router", () => ({
  useFetcher: () => fetcher,
}));

import { useBookingCredits } from "./use-booking-credits";

let latest: ReturnType<typeof useBookingCredits>;

function Probe({ initialAppliedCredits }: { readonly initialAppliedCredits: number }) {
  latest = useBookingCredits(initialAppliedCredits);
  return null;
}

function renderCredits(initialAppliedCredits: number) {
  renderToStaticMarkup(createElement(Probe, { initialAppliedCredits }));
  return latest;
}

describe("useBookingCredits", () => {
  beforeEach(() => {
    fetcher.state = "idle";
    fetcher.data = undefined;
    fetcher.load.mockReset();
  });

  it("stays off until the customer opts in", () => {
    const credits = renderCredits(0);

    expect(credits.enabled).toBe(false);
    expect(credits.requestedCredits).toBe(0);
    expect(credits.hasUsableCredits).toBe(false);
    expect(credits.isLoading).toBe(false);
    expect(credits.error).toBeNull();
    expect(fetcher.load).not.toHaveBeenCalled();
  });

  it("loads the credit balance when the customer opts in", () => {
    const credits = renderCredits(0);

    credits.setCreditsEnabled(true);

    expect(fetcher.load).toHaveBeenCalledWith("/api/referral-credits");
  });

  it("caps requested credits at the lower of available and max", () => {
    fetcher.data = {
      availableCredits: 15_000,
      maxCreditsPerBooking: 8_000,
      error: null,
    };

    const credits = renderCredits(2_000);

    expect(credits.enabled).toBe(true);
    expect(credits.hasUsableCredits).toBe(true);
    expect(credits.requestedCredits).toBe(8_000);
    expect(credits.isLoading).toBe(false);
    expect(credits.error).toBeNull();
  });

  it("keeps previously applied credits while the balance is still loading", () => {
    fetcher.state = "loading";

    const credits = renderCredits(2_500);

    expect(credits.enabled).toBe(true);
    expect(credits.requestedCredits).toBe(2_500);
    expect(credits.isLoading).toBe(true);
  });

  it("does not apply a fetched balance until the customer opts in", () => {
    fetcher.data = {
      availableCredits: 15_000,
      maxCreditsPerBooking: 8_000,
      error: null,
    };

    const credits = renderCredits(0);

    expect(credits.enabled).toBe(false);
    expect(credits.hasUsableCredits).toBe(true);
    expect(credits.requestedCredits).toBe(0);
    expect(credits.error).toBeNull();
  });

  it("does not expose credits when the balance or booking cap is zero", () => {
    fetcher.data = {
      availableCredits: 0,
      maxCreditsPerBooking: 8_000,
      error: null,
    };
    expect(renderCredits(0).hasUsableCredits).toBe(false);

    fetcher.data = {
      availableCredits: 15_000,
      maxCreditsPerBooking: 0,
      error: null,
    };
    expect(renderCredits(0).hasUsableCredits).toBe(false);
  });

  it("surfaces an error and retries the balance load", () => {
    fetcher.data = {
      availableCredits: 0,
      maxCreditsPerBooking: 0,
      error: "Unable to check your booking credits. Please try again.",
    };

    const credits = renderCredits(1_000);

    expect(credits.error).toBe("Unable to check your booking credits. Please try again.");
    expect(credits.hasUsableCredits).toBe(false);
    expect(credits.isLoading).toBe(false);
    expect(credits.requestedCredits).toBe(1_000);

    credits.setCreditsEnabled(true);
    expect(fetcher.load).toHaveBeenCalledWith("/api/referral-credits");
  });

  it("does not reload a successful cached balance", () => {
    fetcher.data = {
      availableCredits: 12_000,
      maxCreditsPerBooking: 5_000,
      error: null,
    };

    const credits = renderCredits(1_000);
    credits.setCreditsEnabled(true);

    expect(fetcher.load).not.toHaveBeenCalled();
    expect(credits.requestedCredits).toBe(5_000);
  });
});
