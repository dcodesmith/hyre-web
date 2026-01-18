import { useEffect, useState, useCallback } from "react";
import type { BookingType } from "~/components/bookingTypes";

interface ReferralDiscount {
  eligible: boolean;
  discountAmount: number;
}

interface BookingCredits {
  readonly availableCredits: number;
  readonly totalEarned: number;
  readonly maxCreditsPerBooking: number;
}

interface UseReferralCreditsParams {
  readonly user: { id: string } | null;
  readonly carIsAvailableToBook: boolean;
  readonly subtotalBeforeDiscounts: number;
  readonly bookingType: BookingType;
}

interface UseReferralCreditsResult {
  readonly referralDiscount: ReferralDiscount | null;
  readonly bookingCredits: BookingCredits | null;
  readonly useCreditsAmount: number;
  readonly handleUseCreditsChange: (checked: boolean) => void;
}

export function useReferralCredits({
  user,
  carIsAvailableToBook,
  subtotalBeforeDiscounts,
  bookingType,
}: UseReferralCreditsParams): UseReferralCreditsResult {
  const [referralDiscount, setReferralDiscount] = useState<ReferralDiscount | null>(null);
  const [bookingCredits, setBookingCredits] = useState<BookingCredits | null>(null);
  const [useCreditsAmount, setUseCreditsAmount] = useState(0);

  // Check referral eligibility when booking details change
  useEffect(() => {
    if (!user || !carIsAvailableToBook || subtotalBeforeDiscounts <= 0) {
      setReferralDiscount(null);
      return;
    }

    const controller = new AbortController();

    const checkEligibility = async () => {
      try {
        const response = await fetch(
          `/api/referrals/eligibility?amount=${subtotalBeforeDiscounts}&type=${bookingType}`,
          { signal: controller.signal },
        );

        if (response.ok) {
          const data = await response.json();
          setReferralDiscount(data);
        } else {
          setReferralDiscount(null);
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        console.error("Failed to check referral eligibility:", error);
        setReferralDiscount(null);
      }
    };

    checkEligibility();

    return () => controller.abort();
  }, [user, carIsAvailableToBook, subtotalBeforeDiscounts, bookingType]);

  // Fetch user's available booking credits
  useEffect(() => {
    if (!user) {
      setBookingCredits(null);
      return;
    }

    const controller = new AbortController();

    const fetchCredits = async () => {
      try {
        const response = await fetch("/api/referrals/user", { signal: controller.signal });
        if (response.ok) {
          const data = await response.json();
          setBookingCredits({
            availableCredits: data.stats?.availableCredits || 0,
            totalEarned: data.stats?.totalEarned || 0,
            maxCreditsPerBooking: data.stats?.maxCreditsPerBooking ?? 0,
          });
        } else {
          setBookingCredits(null);
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        console.error("Failed to fetch booking credits:", error);
        setBookingCredits(null);
      }
    };

    fetchCredits();

    return () => controller.abort();
  }, [user]);

  const referralDiscountAmount =
    user && referralDiscount?.eligible
      ? Math.min(referralDiscount.discountAmount || 0, subtotalBeforeDiscounts)
      : 0;

  // Recompute useCreditsAmount when dependencies change while credits are enabled
  useEffect(() => {
    // Only recompute if credits are currently enabled
    if (useCreditsAmount > 0) {
      if (bookingCredits) {
        setUseCreditsAmount(
          Math.min(
            bookingCredits.availableCredits,
            subtotalBeforeDiscounts - referralDiscountAmount,
            bookingCredits.maxCreditsPerBooking,
          ),
        );
      } else {
        // Clear credits if bookingCredits becomes unavailable
        setUseCreditsAmount(0);
      }
    }
  }, [subtotalBeforeDiscounts, referralDiscountAmount, bookingCredits, useCreditsAmount]);

  const handleUseCreditsChange = useCallback(
    (checked: boolean) => {
      if (checked && bookingCredits) {
        setUseCreditsAmount(
          Math.min(
            bookingCredits.availableCredits,
            subtotalBeforeDiscounts - referralDiscountAmount,
            bookingCredits.maxCreditsPerBooking,
          ),
        );
      } else {
        setUseCreditsAmount(0);
      }
    },
    [subtotalBeforeDiscounts, referralDiscountAmount, bookingCredits],
  );

  return {
    referralDiscount,
    bookingCredits,
    useCreditsAmount,
    handleUseCreditsChange,
  };
}
