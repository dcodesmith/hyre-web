import { redirect } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/r.$code";

const referralCodeSchema = z
  .string()
  .trim()
  .transform((code) => code.toUpperCase())
  .pipe(z.string().regex(/^[A-Z0-9]{8}$/));

export function loader({ params }: Route.LoaderArgs) {
  const code = referralCodeSchema.safeParse(params.code);

  if (!code.success) {
    throw new Response("Referral link not found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  throw redirect(`/auth?ref=${encodeURIComponent(code.data)}`, {
    headers: { "Cache-Control": "no-store" },
  });
}
