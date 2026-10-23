import { useEffect, useEffectEvent } from "react";
import { useFetcher } from "react-router";

import { usePublicUser } from "~/auth/use-public-user";
import type { PhoneVerificationData } from "~/routes/api.phone-verification";

export function useBookingPhoneVerification() {
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

  const result = fetcher.data;
  const visible =
    signedIn && result && !(result.phoneVerified && result.intent == null) ? result : null;

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
    visible,
    pending: fetcher.state === "submitting",
    send,
    check,
  };
}
