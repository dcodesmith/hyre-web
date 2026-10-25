import { useEffect, useEffectEvent } from "react";
import { useFetcher } from "react-router";

import { usePublicUser } from "~/auth/use-public-user";
import type { PhoneVerificationData } from "~/routes/api.phone-verification";

export function phoneVerificationFromProfile(profile: {
  readonly phoneNumber: string | null;
  readonly phoneVerified: boolean;
}): PhoneVerificationData {
  return {
    intent: null,
    phoneNumber: profile.phoneNumber,
    phoneVerified: profile.phoneVerified,
    maskedPhoneNumber: null,
    notice: null,
    error: null,
    fieldErrors: null,
  };
}

export function usePhoneVerification(initial?: PhoneVerificationData | null) {
  const signedIn = usePublicUser() != null;
  const fetcher = useFetcher<PhoneVerificationData>();
  const loadProfile = useEffectEvent(() => {
    if (fetcher.state === "idle" && !fetcher.data) {
      void fetcher.load("/api/phone-verification");
    }
  });

  useEffect(() => {
    if (signedIn) {
      loadProfile();
    }
  }, [signedIn]);

  const result = signedIn ? (fetcher.data ?? initial ?? null) : (initial ?? null);
  const visible = result && !(result.phoneVerified && result.intent == null) ? result : null;

  function send(phoneNumber: string) {
    void fetcher.submit(
      { intent: "send-phone", phoneNumber },
      { method: "post", action: "/api/phone-verification" },
    );
  }

  function check(phoneNumber: string, code: string) {
    void fetcher.submit(
      {
        intent: "check-phone",
        phoneNumber,
        code,
        maskedPhoneNumber: result?.maskedPhoneNumber ?? "",
      },
      { method: "post", action: "/api/phone-verification" },
    );
  }

  return {
    result,
    visible,
    pending: fetcher.state === "submitting",
    phoneVerified: result?.phoneVerified === true,
    send,
    check,
  };
}
