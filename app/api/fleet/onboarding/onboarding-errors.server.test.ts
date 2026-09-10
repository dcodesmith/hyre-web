import { describe, expect, it } from "vitest";

import { ApiRequestError } from "~/api/api.server";
import { HTTP_STATUS } from "~/api/http-status";
import { accountErrorMessage } from "./onboarding-errors.server";

const RETRY_MESSAGE = "Unable to complete this onboarding step. Please try again.";

function apiError(
  status: number,
  detail: string,
  problem: { errorCode?: string; errors?: unknown[] } = {},
) {
  return new ApiRequestError("http", status, {
    type: "FLEET_OWNER_ONBOARDING_ERROR",
    title: "Onboarding error",
    status,
    detail,
    ...problem,
  });
}

describe("accountErrorMessage", () => {
  it("uses formErrors when the API reports a form-level account error", () => {
    expect(
      accountErrorMessage(
        apiError(HTTP_STATUS.CONFLICT, "step incomplete", {
          errorCode: "ACCOUNT_VERIFICATION_STEP_INCOMPLETE",
        }),
      ),
    ).toBe("Finish the previous step before continuing.");
  });

  it("flattens fieldErrors when there is no form error", () => {
    expect(
      accountErrorMessage(
        apiError(HTTP_STATUS.UNPROCESSABLE_ENTITY, "licence required", {
          errors: [
            { field: "driversLicense", message: "Upload your driver's licence to continue." },
            {
              field: "nin",
              message: "We couldn't verify this NIN. Check the number and try again.",
            },
          ],
        }),
      ),
    ).toBe("Upload your driver's licence to continue.");
  });

  it("uses the generic retry message for an unknown 5xx", () => {
    expect(
      accountErrorMessage(apiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, "database exploded")),
    ).toBe(RETRY_MESSAGE);
  });
});
