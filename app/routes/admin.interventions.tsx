import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Link, redirect, useRevalidator } from "react-router";
import { z } from "zod";
import { getVerificationInterventions } from "~/api/admin/interventions/interventions.server";
import type { VerificationIntervention } from "~/api/admin/interventions/schema";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { buildPageMetadata } from "~/seo/metadata";
import type { Route } from "./+types/admin.interventions";

const NO_STORE = { "Cache-Control": "private, no-store" };
const INTERVENTIONS_PAGE_SIZE = 20;

export const meta = () =>
  buildPageMetadata({
    title: "Verification Interventions | Tripdly Admin",
    description: "Review onboarding verification interventions.",
    path: "/admin/interventions",
    index: false,
  });

export function headers() {
  return NO_STORE;
}

export async function loader({ request }: Route.LoaderArgs) {
  const parsedPage = z.coerce
    .number()
    .int()
    .positive()
    .safeParse(new URL(request.url).searchParams.get("page") ?? "1");
  const page = parsedPage.success ? parsedPage.data : 1;
  const response = await getVerificationInterventions({
    request,
    page,
    limit: INTERVENTIONS_PAGE_SIZE,
  });
  if (response.data.meta.totalPages > 0 && page > response.data.meta.totalPages) {
    throw redirect(interventionsPageHref(response.data.meta.totalPages), { headers: NO_STORE });
  }
  return response.data;
}

function kindLabel(kind: VerificationIntervention["kind"]) {
  if (kind === "CHAUFFEUR_FACE") return "Chauffeur face review";
  if (kind === "OWNER_DRIVER_FACE") return "Owner-driver face review";
  if (kind === "OWNER_DRIVER_LICENSE") return "Owner-driver licence review";
  return "Chauffeur licence review";
}

function interventionsPageHref(page: number) {
  return page > 1 ? `/admin/interventions?page=${page}` : "/admin/interventions";
}

function Pagination({ meta }: { readonly meta: Route.ComponentProps["loaderData"]["meta"] }) {
  if (meta.totalPages <= 1) {
    return null;
  }

  return (
    <nav
      aria-label="Verification intervention pagination"
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end"
    >
      <p className="text-center text-sm text-muted-foreground sm:text-left">
        Page {meta.page} of {meta.totalPages} · {meta.total} reviews
      </p>
      <div className="grid grid-cols-2 gap-2 sm:flex">
        <Button asChild={meta.page > 1} disabled={meta.page <= 1} variant="outline">
          {meta.page > 1 ? (
            <Link to={interventionsPageHref(meta.page - 1)}>
              <ChevronLeftIcon data-icon="inline-start" aria-hidden="true" />
              Previous
            </Link>
          ) : (
            <span>
              <ChevronLeftIcon data-icon="inline-start" aria-hidden="true" />
              Previous
            </span>
          )}
        </Button>
        <Button
          asChild={meta.page < meta.totalPages}
          disabled={meta.page >= meta.totalPages}
          variant="outline"
        >
          {meta.page < meta.totalPages ? (
            <Link to={interventionsPageHref(meta.page + 1)}>
              Next
              <ChevronRightIcon data-icon="inline-end" aria-hidden="true" />
            </Link>
          ) : (
            <span>
              Next
              <ChevronRightIcon data-icon="inline-end" aria-hidden="true" />
            </span>
          )}
        </Button>
      </div>
    </nav>
  );
}

export default function AdminInterventionsRoute({ loaderData }: Route.ComponentProps) {
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Verification interventions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review identity photos and driving credentials that require a staff decision.
        </p>
      </div>
      {loaderData.items.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No open verification interventions.
          </CardContent>
        </Card>
      ) : (
        <>
          <ul className="divide-y overflow-hidden rounded-lg border bg-card">
            {loaderData.items.map((intervention) => (
              <li key={intervention.id}>
                <Link
                  to={`/admin/interventions/${intervention.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-muted/50"
                >
                  <span>
                    <span className="block font-medium">{intervention.applicantName}</span>
                    <span className="block text-sm text-muted-foreground">
                      {kindLabel(intervention.kind)}
                    </span>
                  </span>
                  <span className="flex items-center gap-3 text-sm text-muted-foreground">
                    <time dateTime={intervention.createdAt}>
                      {new Date(intervention.createdAt).toLocaleString()}
                    </time>
                    <Badge variant="secondary">Open</Badge>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Pagination meta={loaderData.meta} />
        </>
      )}
    </div>
  );
}

export function ErrorBoundary() {
  const revalidator = useRevalidator();

  return (
    <div className="mx-auto flex min-h-80 max-w-lg flex-col items-center justify-center text-center">
      <h1 className="text-xl font-semibold">Unable to load verification reviews</h1>
      <p className="mt-2 text-sm text-muted-foreground">Please try again.</p>
      <Button
        type="button"
        className="mt-5"
        disabled={revalidator.state !== "idle"}
        onClick={() => revalidator.revalidate()}
      >
        {revalidator.state === "idle" ? "Retry" : "Retrying…"}
      </Button>
    </div>
  );
}
