import { parseWithZod } from "@conform-to/zod/v4";
import { data, redirect } from "react-router";
import { ProfilePage } from "~/account/profile-form";
import { profileFormSchema } from "~/account/profile-form-schema";
import { ApiRequestError } from "~/api/api.server";
import { getAuthSession } from "~/api/auth/auth.server";
import { hasSessionCookie } from "~/api/auth/cookie-relay.server";
import { getCurrentUserProfile, updateCurrentUserProfile } from "~/api/users/users.server";
import { AUTH_NO_STORE } from "~/auth/guest-only.server";
import { authPath } from "~/auth/referer";
import { buildPageMetadata } from "~/seo/metadata";
import type { Route } from "./+types/profile";

export const meta = () =>
  buildPageMetadata({
    title: "Edit Profile | Tripdly",
    description: "Update your Tripdly profile.",
    path: "/profile",
    index: false,
  });

export function headers() {
  return AUTH_NO_STORE;
}

function loginRedirect(request: Request) {
  const url = new URL(request.url);
  return redirect(authPath("/auth", { redirectTo: `${url.pathname}${url.search}` }), {
    headers: AUTH_NO_STORE,
  });
}

export async function loader({ request }: Route.LoaderArgs) {
  if (!hasSessionCookie(request.headers.get("Cookie"))) {
    throw loginRedirect(request);
  }

  try {
    const [session, profile] = await Promise.all([
      getAuthSession({ request }),
      getCurrentUserProfile({ request }),
    ]);

    if (!session) {
      throw loginRedirect(request);
    }

    return { email: session.data.user.email, profile: profile.data };
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    if (error instanceof ApiRequestError && error.status === 401) {
      throw loginRedirect(request);
    }

    throw error;
  }
}

export async function action({ request }: Route.ActionArgs) {
  if (!hasSessionCookie(request.headers.get("Cookie"))) {
    throw loginRedirect(request);
  }

  const submission = parseWithZod(await request.formData(), { schema: profileFormSchema });

  if (submission.status !== "success") {
    return data(submission.reply(), { status: 400, headers: AUTH_NO_STORE });
  }

  try {
    await updateCurrentUserProfile({
      request,
      body: {
        name: submission.value.name,
        phoneNumber: submission.value.phoneNumber,
        city: submission.value.city,
        address: submission.value.address,
        marketingConsent: submission.value.marketingConsent,
      },
    });
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 401) {
      throw loginRedirect(request);
    }

    if (error instanceof ApiRequestError && error.kind === "aborted") {
      throw error;
    }

    const message =
      error instanceof ApiRequestError && error.status < 500
        ? error.problem.detail
        : "Failed to update profile";

    return data(submission.reply({ formErrors: [message] }), {
      status: error instanceof ApiRequestError ? error.status : 502,
      headers: AUTH_NO_STORE,
    });
  }

  return data(submission.reply(), { headers: AUTH_NO_STORE });
}

export default function ProfileRoute({ loaderData, actionData }: Route.ComponentProps) {
  return (
    <ProfilePage email={loaderData.email} profile={loaderData.profile} lastResult={actionData} />
  );
}
