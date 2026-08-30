import { parseWithZod } from "@conform-to/zod/v4";
import { data } from "react-router";

import { ApiRequestError } from "~/api/api.server";
import { requestGuestBookingAccess } from "~/api/bookings/bookings.server";
import { HTTP_STATUS } from "~/api/http-status";
import { AUTH_NO_STORE } from "~/auth/guest-only.server";
import { guestBookingFormSchema } from "~/booking/guest-booking-form-schema";
import {
  type GuestBookingLookupActionData,
  GuestBookingLookupPage,
} from "~/booking/guest-booking-lookup";
import { buildPageMetadata } from "~/seo/metadata";
import type { Route } from "./+types/bookings.lookup";

const LOOKUP_STATUS_MESSAGES = {
  "invalid-link": "This booking link is invalid or has expired. Request a new access link.",
  unavailable: "We couldn’t open that booking link. Request a new link or try again shortly.",
} as const;

export const meta = () =>
  buildPageMetadata({
    title: "Find Your Booking | Tripdly",
    description: "Request secure access to view a Tripdly guest booking.",
    path: "/bookings/lookup",
    index: false,
  });

export function headers() {
  return AUTH_NO_STORE;
}

export function loader({ request }: Route.LoaderArgs) {
  const status = new URL(request.url).searchParams.get("status");

  return {
    statusMessage:
      status === "invalid-link" || status === "unavailable"
        ? LOOKUP_STATUS_MESSAGES[status]
        : undefined,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: guestBookingFormSchema });

  if (submission.status !== "success") {
    return data<GuestBookingLookupActionData>(
      { result: submission.reply() },
      { status: HTTP_STATUS.BAD_REQUEST, headers: AUTH_NO_STORE },
    );
  }

  try {
    const response = await requestGuestBookingAccess({
      request,
      body: submission.value,
    });

    return data<GuestBookingLookupActionData>(
      {
        message: response.data.message,
        result: submission.reply({ resetForm: true }),
      },
      { status: 202, headers: AUTH_NO_STORE },
    );
  } catch (error) {
    if (error instanceof ApiRequestError && error.kind === "aborted") {
      throw error;
    }

    const message =
      error instanceof ApiRequestError && error.status === HTTP_STATUS.TOO_MANY_REQUESTS
        ? "Too many access requests. Please wait before trying again."
        : "We couldn’t send an access link right now. Please try again.";

    return data<GuestBookingLookupActionData>(
      { result: submission.reply({ formErrors: [message] }) },
      {
        status: error instanceof ApiRequestError ? error.status : HTTP_STATUS.BAD_GATEWAY,
        headers: AUTH_NO_STORE,
      },
    );
  }
}

export default function GuestBookingLookupRoute({ actionData, loaderData }: Route.ComponentProps) {
  return (
    <GuestBookingLookupPage actionData={actionData} statusMessage={loaderData.statusMessage} />
  );
}
