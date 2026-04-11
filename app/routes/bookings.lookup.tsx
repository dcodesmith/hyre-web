import { type ActionFunctionArgs, data, redirect } from "react-router";
import { validateCSRF } from "~/utils/csrf-action.server";

export async function action({ request }: ActionFunctionArgs) {
  await validateCSRF(request);

  if (request.method !== "POST") {
    return data({ error: "Method not allowed" }, { status: 405 });
  }

  const formData = await request.formData();
  const email = formData.get("email");
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

  if (!normalizedEmail) {
    return redirect("/bookings?status=confirmed");
  }

  return redirect(`/bookings?status=confirmed&email=${encodeURIComponent(normalizedEmail)}`);
}

export async function loader() {
  return redirect("/bookings");
}
