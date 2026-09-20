import { data } from "react-router";
import { ApiRequestError } from "~/api/api.server";
import { HTTP_STATUS } from "~/api/http-status";
import { getCurrentUserReferralSummary } from "~/api/referrals/referrals.server";
import type { Route } from "./+types/api.referral-credits";

const NO_STORE = { "Cache-Control": "private, no-store" };
const LOAD_ERROR = "Unable to check your referral credit. Please try again.";

export async function loader({ request }: Route.LoaderArgs) {
  try {
    const { data: summary } = await getCurrentUserReferralSummary({ request });
    return data(
      {
        availableCredits: summary.stats.availableCredits,
        maxCreditsPerBooking: summary.stats.maxCreditsPerBooking,
        error: null,
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    if (error instanceof ApiRequestError && error.kind === "aborted") {
      throw error;
    }

    return data(
      {
        availableCredits: 0,
        maxCreditsPerBooking: 0,
        error: LOAD_ERROR,
      },
      {
        status: error instanceof ApiRequestError ? error.status : HTTP_STATUS.BAD_GATEWAY,
        headers: NO_STORE,
      },
    );
  }
}
