import { parseWithZod } from "@conform-to/zod/v4";
import { data, redirect, type ShouldRevalidateFunctionArgs, useRevalidator } from "react-router";

import { ApiRequestError, idempotencyKeyForRetry } from "~/api/api.server";
import {
  getFleetOwnerChauffeurs,
  inviteFleetOwnerChauffeur,
  updateFleetOwnerChauffeur,
} from "~/api/chauffeurs/fleet-owner-chauffeurs.server";
import { HTTP_STATUS } from "~/api/http-status";
import { Button } from "~/components/ui/button";
import {
  type ChauffeurActionData,
  inviteChauffeurFormSchema,
  updateChauffeurFormSchema,
} from "~/fleet/chauffeurs/chauffeur-form-schema";
import {
  chauffeurPagePath,
  parseChauffeursPage,
  toApiChauffeurSearchParams,
} from "~/fleet/chauffeurs/chauffeurs-url";
import { FleetChauffeursPage } from "~/fleet/chauffeurs/fleet-chauffeurs-page";
import { fleetOwnerContext } from "~/fleet/fleet-owner-context";
import { buildPageMetadata } from "~/seo/metadata";
import type { Route } from "./+types/fleet-owner.chauffeurs";

const NO_STORE = { "Cache-Control": "private, no-store" };

export const meta = () =>
  buildPageMetadata({
    title: "Fleet Chauffeurs | Tripdly",
    description: "Invite and manage chauffeurs for your Tripdly fleet.",
    path: "/fleet-owner/chauffeurs",
    index: false,
  });

export function headers() {
  return NO_STORE;
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const page = parseChauffeursPage(new URL(request.url).searchParams);
  const response = await getFleetOwnerChauffeurs({
    request,
    searchParams: toApiChauffeurSearchParams(page),
  });
  const totalPages = Math.max(1, response.data.meta.totalPages);

  if (page > totalPages) {
    throw redirect(chauffeurPagePath(totalPages), { headers: NO_STORE });
  }

  return {
    chauffeurs: response.data.items,
    complianceRequirements: response.data.complianceRequirements,
    idempotencyKey: crypto.randomUUID(),
    isOwnerDriver: context.get(fleetOwnerContext).onboarding.isOwnerDriver === true,
    page,
    total: response.data.meta.total,
    totalPages: response.data.meta.totalPages,
  };
}

function actionError(error: unknown, fallback: string) {
  if (error instanceof ApiRequestError && error.kind === "aborted") {
    throw error;
  }

  return {
    message:
      error instanceof ApiRequestError && error.status < HTTP_STATUS.INTERNAL_SERVER_ERROR
        ? error.problem.detail
        : fallback,
    status: error instanceof ApiRequestError ? error.status : HTTP_STATUS.BAD_GATEWAY,
  };
}

async function inviteAction(request: Request, formData: FormData, isOwnerDriver: boolean) {
  const submission = parseWithZod(formData, { schema: inviteChauffeurFormSchema });

  if (submission.status !== "success") {
    const idempotencyKey = formData.get("idempotencyKey");
    return data<ChauffeurActionData>(
      {
        intent: "invite",
        idempotencyKey: typeof idempotencyKey === "string" ? idempotencyKey : "",
        revalidate: false,
        submission: submission.reply(),
      },
      { status: HTTP_STATUS.BAD_REQUEST, headers: NO_STORE },
    );
  }

  if (isOwnerDriver) {
    return data<ChauffeurActionData>(
      {
        intent: "invite",
        idempotencyKey: submission.value.idempotencyKey,
        error: "Owner-driver accounts cannot invite another chauffeur.",
        revalidate: false,
        submission: submission.reply(),
      },
      { status: HTTP_STATUS.FORBIDDEN, headers: NO_STORE },
    );
  }

  try {
    await inviteFleetOwnerChauffeur({
      request,
      idempotencyKey: submission.value.idempotencyKey,
      body: {
        name: submission.value.name,
        email: submission.value.email,
        phoneNumber: submission.value.phoneNumber,
      },
    });
    return redirect("/fleet-owner/chauffeurs", { headers: NO_STORE });
  } catch (error) {
    const result = actionError(error, "Unable to send the invitation. Please try again.");
    return data<ChauffeurActionData>(
      {
        intent: "invite",
        idempotencyKey: idempotencyKeyForRetry(error, submission.value.idempotencyKey),
        error: result.message,
        revalidate: false,
        submission: submission.reply(),
      },
      { status: result.status, headers: NO_STORE },
    );
  }
}

async function updateAction(request: Request, formData: FormData) {
  const parsed = updateChauffeurFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return data<ChauffeurActionData>(
      {
        intent: "update",
        error: "This chauffeur could not be updated.",
        revalidate: false,
      },
      { status: HTTP_STATUS.BAD_REQUEST, headers: NO_STORE },
    );
  }

  try {
    await updateFleetOwnerChauffeur({
      request,
      chauffeurId: parsed.data.chauffeurId,
      isActive: parsed.data.isActive,
    });
    return data<ChauffeurActionData>(
      { intent: "update", chauffeurId: parsed.data.chauffeurId },
      { headers: NO_STORE },
    );
  } catch (error) {
    const result = actionError(error, "Unable to update this chauffeur. Please try again.");
    return data<ChauffeurActionData>(
      {
        intent: "update",
        chauffeurId: parsed.data.chauffeurId,
        error: result.message,
        revalidate: false,
      },
      { status: result.status, headers: NO_STORE },
    );
  }
}

export async function action({ request, context }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "invite") {
    return inviteAction(
      request,
      formData,
      context.get(fleetOwnerContext).onboarding.isOwnerDriver === true,
    );
  }
  if (intent === "update") {
    return updateAction(request, formData);
  }

  throw data(null, { status: HTTP_STATUS.BAD_REQUEST, headers: NO_STORE });
}

export function shouldRevalidate({
  actionResult,
  currentUrl,
  defaultShouldRevalidate,
  formMethod,
  nextUrl,
}: ShouldRevalidateFunctionArgs) {
  if ((actionResult as ChauffeurActionData | undefined)?.revalidate === false) {
    return false;
  }
  if (
    !formMethod &&
    currentUrl.pathname === nextUrl.pathname &&
    currentUrl.search !== nextUrl.search &&
    currentUrl.searchParams.get("page") === nextUrl.searchParams.get("page")
  ) {
    return false;
  }
  return defaultShouldRevalidate;
}

export default function FleetOwnerChauffeursRoute({
  actionData,
  loaderData,
}: Route.ComponentProps) {
  return <FleetChauffeursPage actionData={actionData} {...loaderData} />;
}

export function ErrorBoundary() {
  const revalidator = useRevalidator();
  return (
    <div className="mx-auto flex min-h-80 max-w-lg flex-col items-center justify-center text-center">
      <h2 className="text-xl font-semibold">Unable to load your chauffeurs</h2>
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
