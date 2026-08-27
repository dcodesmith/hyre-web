interface ShareReferralLinkOptions {
  readonly shareLink: string | null;
  readonly share?: (data: ShareData) => Promise<void>;
  readonly copyLink: (value: string) => Promise<void>;
}

export async function shareReferralLink({ shareLink, share, copyLink }: ShareReferralLinkOptions) {
  if (!shareLink) {
    return;
  }

  if (share) {
    try {
      await share({
        title: "Join Tripdly with my referral code",
        text: "Get a discount on your first booking!",
        url: shareLink,
      });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
    }
  }

  await copyLink(shareLink);
}
