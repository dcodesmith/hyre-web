import { EyeIcon, ShieldCheckIcon, XIcon } from "lucide-react";
import { data, Form, isRouteErrorResponse, Link, redirect, useRouteError } from "react-router";
import { z } from "zod";
import {
  approveIntervention,
  approveOwnerLicenseIntervention,
  getInterventionLicenseNumber,
  getVerificationIntervention,
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
import type { Route } from "./+types/admin.interventions.$interventionId";

const NO_STORE = { "Cache-Control": "private, no-store" };
const actionSchema = z.discriminatedUnion("intent", [
  z.object({ intent: z.literal("reveal") }),
  z.object({
    intent: z.literal("approve"),
    notes: z.string().trim().min(3).max(2000),
    source: z.string().trim().min(2).max(120),
    authoritativeSourceAttested: z.string().optional(),
  }),
  z.object({
    intent: z.literal("reject"),
    notes: z.string().trim().min(3).max(2000),
  }),
  z.object({
    intent: z.literal("request-retake"),
    notes: z.string().trim().min(3).max(2000),
  }),
  z.object({
    intent: z.literal("approve-document"),
  }),
]);

type ActionData = {
  error?: string;
  licenseNumber?: string;
};

export const meta = ({ loaderData }: Route.MetaArgs) =>
  buildPageMetadata({
    title: loaderData
      ? `${loaderData.applicantName} | Verification Interventions`
      : "Verification Intervention | Tripdly Admin",
    description: "Review one onboarding verification intervention.",
    path: "/admin/interventions",
    index: false,
  });

export function headers() {
  return NO_STORE;
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const interventionId = z.uuid().safeParse(params.interventionId);
  if (!interventionId.success) {
    throw data(null, { status: HTTP_STATUS.NOT_FOUND, headers: NO_STORE });
  }
  try {
    const response = await getVerificationIntervention({
      request,
      interventionId: interventionId.data,
    });
    return response.data;
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === HTTP_STATUS.NOT_FOUND) {
      throw data(null, { status: HTTP_STATUS.NOT_FOUND, headers: NO_STORE });
    }
    throw error;
  }
}

function actionError(error: unknown) {
  return data<ActionData>(
    {
      error:
        error instanceof ApiRequestError && error.status < HTTP_STATUS.INTERNAL_SERVER_ERROR
          ? error.problem.detail
          : "Unable to complete this review action. Please try again.",
    },
    {
      status: error instanceof ApiRequestError ? error.status : HTTP_STATUS.BAD_GATEWAY,
      headers: NO_STORE,
    },
  );
}

export async function action({ params, request }: Route.ActionArgs) {
  const interventionId = z.uuid().safeParse(params.interventionId);
  if (!interventionId.success) {
    throw data(null, { status: HTTP_STATUS.NOT_FOUND, headers: NO_STORE });
  }
  const submission = actionSchema.safeParse(Object.fromEntries(await request.formData()));
  if (!submission.success) {
    return data<ActionData>(
      { error: submission.error.issues[0]?.message ?? "Invalid review action" },
      { status: HTTP_STATUS.BAD_REQUEST, headers: NO_STORE },
    );
  }
  try {
    const review = submission.data;
    const id = interventionId.data;
    if (review.intent === "reveal") {
      const response = await getInterventionLicenseNumber(request, id);
      return data<ActionData>(
        { licenseNumber: response.data.licenseNumber },
        { headers: NO_STORE },
      );
    }
    if (review.intent === "approve-document") {
      await approveOwnerLicenseIntervention(request, id);
    } else if (review.intent === "approve") {
      await approveIntervention({
        request,
        interventionId: id,
        notes: review.notes,
        source: review.source,
        authoritativeSourceAttested: review.authoritativeSourceAttested === "on",
      });
    } else if (review.intent === "request-retake") {
      await requestInterventionSelfieRetake(request, id, review.notes);
    } else {
      await rejectIntervention(request, id, review.notes);
    }
    return redirect("/admin/interventions", { headers: NO_STORE });
  } catch (error) {
    return actionError(error);
  }
}

function kindLabel(kind: VerificationIntervention["kind"]) {
  if (kind === "CHAUFFEUR_FACE") return "Chauffeur face review";
  if (kind === "OWNER_DRIVER_FACE") return "Owner-driver face review";
  if (kind === "OWNER_DRIVER_LICENSE") return "Owner-driver licence review";
  return "Chauffeur licence review";
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

function ReviewActions({ intervention }: { readonly intervention: VerificationIntervention }) {
  const isFace =
    intervention.kind === "CHAUFFEUR_FACE" || intervention.kind === "OWNER_DRIVER_FACE";
  const isOwnerLicense = intervention.kind === "OWNER_DRIVER_LICENSE";

  return (
    <>
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
    </>
  );
}

export default function AdminInterventionRoute({ actionData, loaderData }: Route.ComponentProps) {
  const intervention = loaderData;
  const isFace =
    intervention.kind === "CHAUFFEUR_FACE" || intervention.kind === "OWNER_DRIVER_FACE";
  const isOwnerLicense = intervention.kind === "OWNER_DRIVER_LICENSE";
  const isOpen = intervention.status === "OPEN";

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link
        to="/admin/interventions"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        All reviews
      </Link>
      {actionData?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {actionData.error}
        </p>
      ) : null}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>
                <h1>{intervention.applicantName}</h1>
              </CardTitle>
              <CardDescription>{kindLabel(intervention.kind)}</CardDescription>
            </div>
            <Badge variant="secondary">{isOpen ? "Open" : intervention.status}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Opened</dt>
              <dd>
                <time dateTime={intervention.createdAt}>
                  {new Date(intervention.createdAt).toLocaleString()}
                </time>
              </dd>
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
          {isOpen && isFace ? <FaceEvidence intervention={intervention} /> : null}
          {isOpen && !isFace && !isOwnerLicense ? (
            <div className="space-y-2">
              <Form method="post">
                <input type="hidden" name="intent" value="reveal" />
                <Button type="submit" variant="outline">
                  <EyeIcon data-icon="inline-start" />
                  Reveal full licence number
                </Button>
              </Form>
              {actionData?.licenseNumber ? (
                <output className="block rounded-md border bg-muted px-3 py-2 font-mono text-sm">
                  {actionData.licenseNumber}
                </output>
              ) : null}
            </div>
          ) : null}
          {isOpen ? <ReviewActions intervention={intervention} /> : null}
        </CardContent>
      </Card>
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === HTTP_STATUS.NOT_FOUND;

  return (
    <div className="mx-auto flex min-h-80 max-w-lg flex-col items-center justify-center text-center">
      <h1 className="text-xl font-semibold">
        {notFound ? "Review not found" : "Unable to load this review"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {notFound
          ? "This review is not available."
          : "Please return to verification reviews and try again."}
      </p>
      <Button asChild className="mt-5">
        <Link to="/admin/interventions">All reviews</Link>
      </Button>
    </div>
  );
}
