import { ChevronLeftIcon, ChevronRightIcon, EyeIcon, ShieldCheckIcon, XIcon } from "lucide-react";
import { data, Form, Link, redirect } from "react-router";
import { z } from "zod";
import {
  approveIntervention,
  approveOwnerLicenseIntervention,
  getInterventionLicenseNumber,
  getVerificationInterventions,
  rejectIntervention,
  requestInterventionSelfieRetake,
} from "~/api/admin/interventions/interventions.server";
import type { VerificationIntervention } from "~/api/admin/interventions/schema";
import { ApiRequestError } from "~/api/api.server";
import { HTTP_STATUS } from "~/api/http-status";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { buildPageMetadata } from "~/seo/metadata";
import type { Route } from "./+types/admin.interventions";

const NO_STORE = { "Cache-Control": "private, no-store" };
const INTERVENTIONS_PAGE_SIZE = 20;
const actionSchema = z.discriminatedUnion("intent", [
  z.object({ intent: z.literal("reveal"), interventionId: z.uuid() }),
  z.object({
    intent: z.literal("approve"),
    interventionId: z.uuid(),
    notes: z.string().trim().min(3).max(2000),
    source: z.string().trim().min(2).max(120),
    authoritativeSourceAttested: z.string().optional(),
  }),
  z.object({
    intent: z.literal("reject"),
    interventionId: z.uuid(),
    notes: z.string().trim().min(3).max(2000),
  }),
  z.object({
    intent: z.literal("request-retake"),
    interventionId: z.uuid(),
    notes: z.string().trim().min(3).max(2000),
  }),
  z.object({
    intent: z.literal("approve-document"),
    interventionId: z.uuid(),
  }),
]);

type ActionData = {
  error?: string;
  licenseNumber?: string;
  revealedInterventionId?: string;
};

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

export async function action({ request }: Route.ActionArgs) {
  const submission = actionSchema.safeParse(Object.fromEntries(await request.formData()));
  if (!submission.success) {
    return data<ActionData>(
      { error: submission.error.issues[0]?.message ?? "Invalid review action" },
      { status: HTTP_STATUS.BAD_REQUEST, headers: NO_STORE },
    );
  }
  try {
    const action = submission.data;
    if (action.intent === "reveal") {
      const response = await getInterventionLicenseNumber(request, action.interventionId);
      return data<ActionData>(
        {
          licenseNumber: response.data.licenseNumber,
          revealedInterventionId: action.interventionId,
        },
        { headers: NO_STORE },
      );
    }
    if (action.intent === "approve-document") {
      await approveOwnerLicenseIntervention(request, action.interventionId);
    } else if (action.intent === "approve") {
      await approveIntervention({
        request,
        interventionId: action.interventionId,
        notes: action.notes,
        source: action.source,
        authoritativeSourceAttested: action.authoritativeSourceAttested === "on",
      });
    } else if (action.intent === "request-retake") {
      await requestInterventionSelfieRetake(request, action.interventionId, action.notes);
    } else {
      await rejectIntervention(request, action.interventionId, action.notes);
    }
    return data<ActionData>({}, { headers: NO_STORE });
  } catch (error) {
    const message =
      error instanceof ApiRequestError && error.status < HTTP_STATUS.INTERNAL_SERVER_ERROR
        ? error.problem.detail
        : "Unable to complete this review action. Please try again.";
    return data<ActionData>(
      { error: message },
      {
        status: error instanceof ApiRequestError ? error.status : HTTP_STATUS.BAD_GATEWAY,
        headers: NO_STORE,
      },
    );
  }
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

function FaceEvidence({ intervention }: { readonly intervention: VerificationIntervention }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {intervention.hasSelfie ? (
        <figure>
          <img
            className="aspect-square w-full rounded-lg border object-cover"
            src={`/admin/interventions/${intervention.id}/evidence/selfie`}
            alt="Submitted chauffeur selfie"
            loading="lazy"
            decoding="async"
          />
          <figcaption className="mt-1 text-xs text-muted-foreground">Submitted selfie</figcaption>
        </figure>
      ) : null}
      {intervention.hasNinPortrait ? (
        <figure>
          <img
            className="aspect-square w-full rounded-lg border object-cover"
            src={`/admin/interventions/${intervention.id}/evidence/nin-portrait`}
            alt="Official NIN portrait"
            loading="lazy"
            decoding="async"
          />
          <figcaption className="mt-1 text-xs text-muted-foreground">NIN portrait</figcaption>
        </figure>
      ) : null}
    </div>
  );
}

function InterventionCard({
  actionData,
  intervention,
}: {
  actionData?: ActionData;
  intervention: VerificationIntervention;
}) {
  const isFace =
    intervention.kind === "CHAUFFEUR_FACE" || intervention.kind === "OWNER_DRIVER_FACE";
  const isOwnerLicense = intervention.kind === "OWNER_DRIVER_LICENSE";
  const revealed =
    actionData?.revealedInterventionId === intervention.id ? actionData.licenseNumber : undefined;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>
              <h2>{intervention.applicantName}</h2>
            </CardTitle>
            <CardDescription>{kindLabel(intervention.kind)}</CardDescription>
          </div>
          <Badge variant="secondary">Open</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Opened</dt>
            <dd>{new Date(intervention.createdAt).toLocaleString()}</dd>
          </div>
          {!isFace ? (
            <div>
              <dt className="text-muted-foreground">Licence</dt>
              <dd>
                {intervention.licenseLast4 ? `Ending ${intervention.licenseLast4}` : "Submitted"}
              </dd>
            </div>
          ) : null}
        </dl>

        {isFace ? (
          <FaceEvidence intervention={intervention} />
        ) : !isOwnerLicense ? (
          <div className="space-y-2">
            <Form method="post">
              <input type="hidden" name="intent" value="reveal" />
              <input type="hidden" name="interventionId" value={intervention.id} />
              <Button type="submit" variant="outline">
                <EyeIcon data-icon="inline-start" />
                Reveal full licence number
              </Button>
            </Form>
            {revealed ? (
              <output className="block rounded-md border bg-muted px-3 py-2 font-mono text-sm">
                {revealed}
              </output>
            ) : null}
          </div>
        ) : null}

        {isOwnerLicense ? (
          intervention.document ? (
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <a
                  href={`/admin/documents/${intervention.document.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View private licence document
                </a>
              </Button>
              {intervention.document.status !== "APPROVED" ? (
                <Form method="post">
                  <input type="hidden" name="intent" value="approve-document" />
                  <input type="hidden" name="interventionId" value={intervention.id} />
                  <Button type="submit">
                    <ShieldCheckIcon data-icon="inline-start" />
                    Approve document as replacement
                  </Button>
                </Form>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-destructive">No submitted licence document is available.</p>
          )
        ) : (
          <Form method="post" className="space-y-3 rounded-lg border p-4">
            <input type="hidden" name="intent" value="approve" />
            <input type="hidden" name="interventionId" value={intervention.id} />
            <Input
              name="source"
              required
              placeholder={isFace ? "Visual comparison" : "FRSC or equivalent source"}
              defaultValue={isFace ? "VISUAL_COMPARISON" : ""}
              aria-label="Evidence source"
            />
            <textarea
              name="notes"
              required
              minLength={3}
              maxLength={2000}
              className="min-h-24 w-full rounded-md border bg-transparent px-3 py-2 text-sm"
              placeholder="Review notes"
              aria-label="Approval notes"
            />
            {!isFace ? (
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="authoritativeSourceAttested" required />I checked the
                full licence number against an independent authoritative source.
              </label>
            ) : null}
            <Button type="submit">
              <ShieldCheckIcon data-icon="inline-start" />
              Approve
            </Button>
          </Form>
        )}

        {isFace ? (
          <Form method="post" className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row">
            <input type="hidden" name="interventionId" value={intervention.id} />
            <Input
              name="notes"
              required
              minLength={3}
              maxLength={2000}
              placeholder="Retake notes"
              aria-label="Retake notes"
            />
            <Button type="submit" name="intent" value="request-retake" variant="outline">
              Request retake
            </Button>
          </Form>
        ) : null}
        <Form method="post" className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row">
          <input type="hidden" name="interventionId" value={intervention.id} />
          <Input
            name="notes"
            required
            minLength={3}
            maxLength={2000}
            placeholder="Rejection notes"
            aria-label="Rejection notes"
          />
          <Button type="submit" name="intent" value="reject" variant="destructive">
            <XIcon data-icon="inline-start" />
            Reject
          </Button>
        </Form>
      </CardContent>
    </Card>
  );
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

export default function AdminInterventionsRoute({ actionData, loaderData }: Route.ComponentProps) {
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Verification interventions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review identity photos and driving credentials that require a staff decision.
        </p>
      </div>
      {actionData?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {actionData.error}
        </p>
      ) : null}
      {loaderData.items.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No open verification interventions.
          </CardContent>
        </Card>
      ) : (
        <>
          {loaderData.items.map((intervention) => (
            <InterventionCard
              key={intervention.id}
              intervention={intervention}
              actionData={actionData}
            />
          ))}
          <Pagination meta={loaderData.meta} />
        </>
      )}
    </div>
  );
}
