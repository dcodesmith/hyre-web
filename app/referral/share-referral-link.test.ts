import { describe, expect, it, vi } from "vitest";

import { shareReferralLink } from "./share-referral-link";

const shareLink = "https://tripdly.com/auth?ref=ADA2026X";

describe("shareReferralLink", () => {
  it("falls back to copying when native sharing fails", async () => {
    const share = vi.fn().mockRejectedValue(new Error("Native sharing unavailable"));
    const copyLink = vi.fn().mockResolvedValue(undefined);

    await shareReferralLink({ shareLink, share, copyLink });

    expect(share).toHaveBeenCalledOnce();
    expect(copyLink).toHaveBeenCalledWith(shareLink);
  });

  it("does not copy when the user cancels native sharing", async () => {
    const share = vi.fn().mockRejectedValue(new DOMException("Cancelled", "AbortError"));
    const copyLink = vi.fn().mockResolvedValue(undefined);

    await shareReferralLink({ shareLink, share, copyLink });

    expect(copyLink).not.toHaveBeenCalled();
  });
});
