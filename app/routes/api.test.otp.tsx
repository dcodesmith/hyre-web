import type { LoaderFunctionArgs } from "react-router";
import { isE2ETesting, retrieveTestOTP } from "~/modules/auth/otp-test-store.server";

/**
 * Test-only endpoint that returns the most recent OTP for a given email.
 * Only available when E2E_TESTING=true.
 *
 * GET /api/test/otp?email=user@example.com
 */
export async function loader({ request }: LoaderFunctionArgs) {
  if (!isE2ETesting() || process.env.NODE_ENV === "production") {
    throw new Response("Not Found", { status: 404 });
  }

  const email = new URL(request.url).searchParams.get("email");
  if (!email) {
    return Response.json({ error: "email query param required" }, { status: 400 });
  }

  const otp = retrieveTestOTP(email);
  if (!otp) {
    return Response.json({ error: "No OTP found for this email" }, { status: 404 });
  }

  return Response.json(
    { otp },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
        Pragma: "no-cache",
      },
    },
  );
}
