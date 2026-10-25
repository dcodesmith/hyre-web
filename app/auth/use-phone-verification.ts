import { useEffect, useRef } from "react";
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
    verificationToken: null,
    maskedPhoneNumber: null,
    notice: null,
    error: null,
    fieldErrors: null,
  };
}

export function nextPhoneActionResult(
  current: PhoneVerificationData | null,
  data: PhoneVerificationData | null | undefined,
) {
  return data?.intent != null ? data : current;
}

export function usePhoneVerification(initial?: PhoneVerificationData | null) {
  const signedIn = usePublicUser() != null;
  const fetcher = useFetcher<PhoneVerificationData>();
  const lastActionRef = useRef<PhoneVerificationData | null>(null);
  const lastSignedInRef = useRef(signedIn);
  const dataBeforeAuthChangeRef = useRef<PhoneVerificationData | undefined>(undefined);
  const awaitingProfileRef = useRef(signedIn && !fetcher.data);

  const authChanged = lastSignedInRef.current !== signedIn;
  if (authChanged) {
    lastActionRef.current = null;
    lastSignedInRef.current = signedIn;
    dataBeforeAuthChangeRef.current = fetcher.data;
    awaitingProfileRef.current = signedIn;
  } else {
    const freshData = fetcher.data === dataBeforeAuthChangeRef.current ? undefined : fetcher.data;
    if (awaitingProfileRef.current && freshData?.intent === null) {
      awaitingProfileRef.current = false;
    }
    if (!awaitingProfileRef.current) {
      lastActionRef.current = nextPhoneActionResult(lastActionRef.current, freshData);
    }
  }

  const freshData = fetcher.data === dataBeforeAuthChangeRef.current ? undefined : fetcher.data;
  const currentData = awaitingProfileRef.current ? undefined : freshData;
  const result = lastActionRef.current ?? currentData ?? initial ?? null;
  const visible = result && !(result.phoneVerified && result.intent == null) ? result : null;
  const shouldLoadProfile =
    signedIn && fetcher.state === "idle" && (awaitingProfileRef.current || !fetcher.data);
  const loadProfile = fetcher.load;

  useEffect(() => {
    if (shouldLoadProfile) {
      void loadProfile("/api/phone-verification");
    }
  }, [loadProfile, shouldLoadProfile]);

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
