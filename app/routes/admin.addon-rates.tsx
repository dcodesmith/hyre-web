import { parseWithZod } from "@conform-to/zod/v4";
import { data, type ShouldRevalidateFunctionArgs, useRevalidator } from "react-router";

import { AdminAddonRatesPage } from "~/admin/rates/admin-addon-rates-page";
import {
  addonRateFormSchema,
  endAddonRateFormSchema,
  type RateActionData,
  toUtcIso,
} from "~/admin/rates/rate-form-schema";
import {
  createAdminAddonRate,
  endAdminAddonRate,
  getAdminRates,
} from "~/api/admin/rates/rates.server";
import { ApiRequestError } from "~/api/api.server";
import { HTTP_STATUS } from "~/api/http-status";
import { requireAdminContext } from "~/auth/admin-context.server";
import { Button } from "~/components/ui/button";
import { buildPageMetadata } from "~/seo/metadata";
import type { Route } from "./+types/admin.addon-rates";

const NO_STORE = { "Cache-Control": "private, no-store" };

export const meta = () =>
  buildPageMetadata({
    title: "Add-on Rates | Tripdly Admin",
    description: "Manage Tripdly security detail rate windows.",
    path: "/admin/addon-rates",
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
  return { now: new Date().toISOString(), rates: rates.addonRates };
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

async function createAddonAction(request: Request, formData: FormData) {
  const submission = parseWithZod(formData, { schema: addonRateFormSchema });
  if (submission.status !== "success") {
    return data<RateActionData>(
      { intent: "create-addon", revalidate: false, submission: submission.reply() },
      { status: HTTP_STATUS.BAD_REQUEST, headers: NO_STORE },
    );
  }

  try {
    const value = submission.value;
    await createAdminAddonRate({
      request,
      body: {
        addonType: "SECURITY_DETAIL",
        rateAmount: value.rateAmount,
        effectiveSince: toUtcIso(value.effectiveSince),
        effectiveUntil: value.effectiveUntil ? toUtcIso(value.effectiveUntil) : undefined,
        description: value.description,
      },
    });
    return data<RateActionData>(
      { intent: "create-addon", success: "Add-on rate created." },
      { headers: NO_STORE },
    );
  } catch (error) {
    const { message, status } = actionError(
      error,
      "Unable to create the add-on rate. Please try again.",
    );
    return data<RateActionData>(
      { intent: "create-addon", error: message, submission: submission.reply() },
      { status, headers: NO_STORE },
    );
  }
}

async function endAddonAction(request: Request, formData: FormData) {
  const submission = endAddonRateFormSchema.safeParse(Object.fromEntries(formData));
  if (!submission.success) {
    return data<RateActionData>(
      {
        intent: "end-addon",
        error: "This add-on rate cannot be ended.",
        revalidate: false,
      },
      { status: HTTP_STATUS.BAD_REQUEST, headers: NO_STORE },
    );
  }

  try {
    await endAdminAddonRate({ request, addonRateId: submission.data.addonRateId });
    return data<RateActionData>(
      { intent: "end-addon", success: "Add-on rate ended." },
      { headers: NO_STORE },
    );
  } catch (error) {
    const { message, status } = actionError(
      error,
      "Unable to end the add-on rate. Please try again.",
    );
    return data<RateActionData>(
      { intent: "end-addon", error: message },
      { status, headers: NO_STORE },
    );
  }
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create-addon") {
    return createAddonAction(request, formData);
  }
  if (intent === "end-addon") {
    return endAddonAction(request, formData);
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

export default function AdminAddonRatesRoute({ loaderData }: Route.ComponentProps) {
  return <AdminAddonRatesPage now={loaderData.now} rates={loaderData.rates} />;
}

export function ErrorBoundary() {
  const revalidator = useRevalidator();

  return (
    <div className="mx-auto flex min-h-80 max-w-lg flex-col items-center justify-center text-center">
      <h2 className="text-xl font-semibold">Unable to load add-on rates</h2>
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
