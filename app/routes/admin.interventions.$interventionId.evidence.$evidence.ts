import { data } from "react-router";
import { getInterventionEvidence } from "~/api/admin/interventions/interventions.server";
import type { Route } from "./+types/admin.interventions.$interventionId.evidence.$evidence";

export async function loader({ request, params }: Route.LoaderArgs) {
  if (params.evidence !== "selfie" && params.evidence !== "nin-portrait") {
    throw data(null, { status: 404 });
  }
  const upstream = await getInterventionEvidence(request, params.interventionId, params.evidence);
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
    },
  });
}
