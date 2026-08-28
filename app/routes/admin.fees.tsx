import { parseWithZod } from "@conform-to/zod/v4";
import { data, type ShouldRevalidateFunctionArgs, useRevalidator } from "react-router";

import { AdminFeesPage } from "~/admin/rates/admin-fees-page";
import {
  platformFeeFormSchema,
  type RateActionData,
  toUtcIso,
  vatRateFormSchema,
} from "~/admin/rates/rate-form-schema";
import {
  createAdminPlatformFee,
  createAdminVatRate,
  getAdminRates,
} from "~/api/admin/rates/rates.server";
import { ApiRequestError } from "~/api/api.server";
import { HTTP_STATUS } from "~/api/http-status";
import { requireAdminContext } from "~/auth/admin-context.server";
import { Button } from "~/components/ui/button";
import { buildPageMetadata } from "~/seo/metadata";
import type { Route } from "./+types/admin.fees";

const NO_STORE = { "Cache-Control": "private, no-store" };

export const meta = () =>
  buildPageMetadata({
    title: "Fees and VAT | Tripdly Admin",
    description: "Manage Tripdly platform fee and VAT rate windows.",
    path: "/admin/fees",
    index: false,
  });

export function headers() {
  return NO_STORE;
}

export const middleware: Route.MiddlewareFunction[] = [
  ({ context }) => requireAdminContext(context),
];

export async function loader({ request }: Route.LoaderArgs) {
  const { data: rates } = await getAdminRates({ request });
  return { platformFeeRates: rates.platformFeeRates, taxRates: rates.taxRates };
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

async function createVatAction(request: Request, formData: FormData) {
  const submission = parseWithZod(formData, { schema: vatRateFormSchema });
  if (submission.status !== "success") {
    return data<RateActionData>(
      { intent: "vat", revalidate: false, submission: submission.reply() },
      { status: HTTP_STATUS.BAD_REQUEST, headers: NO_STORE },
    );
  }

  try {
    const value = submission.value;
    await createAdminVatRate({
      request,
      body: {
        ratePercent: value.ratePercent,
        effectiveSince: toUtcIso(value.effectiveSince),
        effectiveUntil: value.effectiveUntil ? toUtcIso(value.effectiveUntil) : undefined,
        description: value.description,
      },
    });
    return data<RateActionData>(
      { intent: "vat", success: "VAT rate scheduled." },
      { headers: NO_STORE },
    );
  } catch (error) {
    const { message, status } = actionError(
      error,
      "Unable to save the VAT rate. Please try again.",
    );
    return data<RateActionData>(
      { intent: "vat", error: message, submission: submission.reply() },
      { status, headers: NO_STORE },
    );
  }
}

async function createPlatformFeeAction(request: Request, formData: FormData) {
  const submission = parseWithZod(formData, { schema: platformFeeFormSchema });
  if (submission.status !== "success") {
    return data<RateActionData>(
      { intent: "platform-fee", revalidate: false, submission: submission.reply() },
      { status: HTTP_STATUS.BAD_REQUEST, headers: NO_STORE },
    );
  }

  try {
    const value = submission.value;
    await createAdminPlatformFee({
      request,
      body: {
        feeType: value.feeType,
        ratePercent: value.ratePercent,
        effectiveSince: toUtcIso(value.effectiveSince),
        effectiveUntil: value.effectiveUntil ? toUtcIso(value.effectiveUntil) : undefined,
        description: value.description,
      },
    });
    return data<RateActionData>(
      { intent: "platform-fee", success: "Platform fee scheduled." },
      { headers: NO_STORE },
    );
  } catch (error) {
    const { message, status } = actionError(
      error,
      "Unable to save the platform fee. Please try again.",
    );
    return data<RateActionData>(
      { intent: "platform-fee", error: message, submission: submission.reply() },
      { status, headers: NO_STORE },
    );
  }
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "vat") {
    return createVatAction(request, formData);
  }
  if (intent === "platform-fee") {
    return createPlatformFeeAction(request, formData);
  }

  throw data(null, { status: HTTP_STATUS.BAD_REQUEST, headers: NO_STORE });
}

export function shouldRevalidate({
  actionResult,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if ((actionResult as RateActionData | undefined)?.revalidate === false) {
    return false;
  }
  return defaultShouldRevalidate;
}

export default function AdminFeesRoute({ loaderData }: Route.ComponentProps) {
  return (
    <AdminFeesPage platformFeeRates={loaderData.platformFeeRates} taxRates={loaderData.taxRates} />
  );
}

export function ErrorBoundary() {
  const revalidator = useRevalidator();

  return (
    <div className="mx-auto flex min-h-80 max-w-lg flex-col items-center justify-center text-center">
      <h2 className="text-xl font-semibold">Unable to load fees and VAT</h2>
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
