import { parseWithZod } from "@conform-to/zod/v4";
import { data, redirect, type ShouldRevalidateFunctionArgs, useRevalidator } from "react-router";

import { ApiRequestError } from "~/api/api.server";
import { getFleetCars } from "~/api/fleet/cars/cars.server";
import {
  createFleetOwnerPromotion,
  deactivateFleetOwnerPromotion,
  getFleetOwnerPromotions,
} from "~/api/fleet/promotions/promotions.server";
import { HTTP_STATUS } from "~/api/http-status";
import { Button } from "~/components/ui/button";
import { FleetPromotionsPage } from "~/fleet/promotions/fleet-promotions-page";
import {
  createPromotionFormSchema,
  deactivatePromotionFormSchema,
  type PromotionActionData,
} from "~/fleet/promotions/promotion-form-schema";
import { buildPageMetadata } from "~/seo/metadata";
import type { Route } from "./+types/fleet-owner.promotions";

const NO_STORE = { "Cache-Control": "private, no-store" };

export const meta = () =>
  buildPageMetadata({
    title: "Fleet Promotions | Tripdly",
    description: "Manage discounts for your Tripdly fleet.",
    path: "/fleet-owner/promotions",
    index: false,
  });

export function headers() {
  return NO_STORE;
}

export async function loader({ request }: Route.LoaderArgs) {
  const [promotionsResponse, carsResponse] = await Promise.all([
    getFleetOwnerPromotions({ request }),
    getFleetCars({ request }),
  ]);

  return {
    promotions: promotionsResponse.data,
    cars: carsResponse.data.map(({ id, make, model, year, registrationNumber }) => ({
      id,
      make,
      model,
      year,
      registrationNumber,
    })),
    now: new Date().toISOString(),
  };
}

function getPromotionActionError(error: unknown, fallback: string) {
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

async function createPromotionAction(request: Request, formData: FormData) {
  const submission = parseWithZod(formData, { schema: createPromotionFormSchema });

  if (submission.status !== "success") {
    return data<PromotionActionData>(
      { intent: "create", revalidate: false, submission: submission.reply() },
      { status: HTTP_STATUS.BAD_REQUEST, headers: NO_STORE },
    );
  }

  try {
    const { name, target, discountValue, startDate, endDate } = submission.value;
    await createFleetOwnerPromotion({
      request,
      body: {
        name,
        scope: target === "FLEET" ? "FLEET" : "CAR",
        carId: target === "FLEET" ? undefined : target,
        discountValue,
        startDate,
        endDate,
      },
    });

    return redirect("/fleet-owner/promotions", { headers: NO_STORE });
  } catch (error) {
    const { message, status } = getPromotionActionError(
      error,
      "Failed to create promotion. Please try again.",
    );

    return data<PromotionActionData>(
      {
        intent: "create",
        submission: submission.reply({ formErrors: [message] }),
      },
      { status, headers: NO_STORE },
    );
  }
}

async function deactivatePromotionAction(request: Request, formData: FormData) {
  const parsed = deactivatePromotionFormSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return data<PromotionActionData>(
      { intent: "deactivate", error: "This promotion cannot be deactivated." },
      { status: HTTP_STATUS.BAD_REQUEST, headers: NO_STORE },
    );
  }

  try {
    await deactivateFleetOwnerPromotion({
      request,
      promotionId: parsed.data.promotionId,
    });
    return data<PromotionActionData>({ intent: "deactivate" }, { headers: NO_STORE });
  } catch (error) {
    const { message, status } = getPromotionActionError(
      error,
      "Failed to deactivate promotion. Please try again.",
    );
    return data<PromotionActionData>(
      { intent: "deactivate", error: message },
      { status, headers: NO_STORE },
    );
  }
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    return createPromotionAction(request, formData);
  }

  if (intent === "deactivate") {
    return deactivatePromotionAction(request, formData);
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
  if ((actionResult as PromotionActionData | undefined)?.revalidate === false) {
    return false;
  }

  if (
    !formMethod &&
    currentUrl.pathname === nextUrl.pathname &&
    currentUrl.search !== nextUrl.search
  ) {
    return false;
  }

  return defaultShouldRevalidate;
}

export default function FleetOwnerPromotionsRoute({
  actionData,
  loaderData,
}: Route.ComponentProps) {
  return (
    <FleetPromotionsPage
      actionData={actionData}
      cars={loaderData.cars}
      now={loaderData.now}
      promotions={loaderData.promotions}
    />
  );
}

export function ErrorBoundary() {
  const revalidator = useRevalidator();

  return (
    <div className="mx-auto flex min-h-80 max-w-lg flex-col items-center justify-center text-center">
      <h2 className="text-xl font-semibold">Unable to load your promotions</h2>
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
