import { parseWithZod } from "@conform-to/zod/v4";
import { data, type ShouldRevalidateFunctionArgs, useRevalidator } from "react-router";
import {
  type AddonActionData,
  createAddonFormSchema,
  createAddonPriceFormSchema,
  endAddonPriceFormSchema,
  toUtcIso,
  updateAddonFormSchema,
} from "~/admin/addons/addon-form-schema";
import { AdminAddonsPage } from "~/admin/addons/admin-addons-page";
import {
  createAdminAddon,
  createAdminAddonPrice,
  endAdminAddonPrice,
  getAdminAddons,
  updateAdminAddon,
} from "~/api/admin/addons/addons.server";
import { ApiRequestError } from "~/api/api.server";
import { HTTP_STATUS } from "~/api/http-status";
import { Button } from "~/components/ui/button";
import { buildPageMetadata } from "~/seo/metadata";
import type { Route } from "./+types/admin.addon-rates";

const NO_STORE = { "Cache-Control": "private, no-store" };

export const meta = () =>
  buildPageMetadata({
    title: "Add-ons | Tripdly Admin",
    description: "Manage Tripdly booking add-ons and price windows.",
    path: "/admin/addon-rates",
    index: false,
  });

export function headers() {
  return NO_STORE;
}

export async function loader({ request }: Route.LoaderArgs) {
  const response = await getAdminAddons({ request });
  return { now: new Date().toISOString(), addons: response.data.addons };
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
  const submission = parseWithZod(formData, { schema: createAddonFormSchema });
  if (submission.status !== "success") {
    return data<AddonActionData>(
      { intent: "create-addon", revalidate: false, submission: submission.reply() },
      { status: HTTP_STATUS.BAD_REQUEST, headers: NO_STORE },
    );
  }

  try {
    await createAdminAddon({
      request,
      body: { ...submission.value, isActive: true },
    });
    return data<AddonActionData>(
      { intent: "create-addon", success: "Add-on created." },
      { headers: NO_STORE },
    );
  } catch (error) {
    const { message, status } = actionError(error, "Unable to create the add-on.");
    return data<AddonActionData>(
      { intent: "create-addon", error: message, submission: submission.reply() },
      { status, headers: NO_STORE },
    );
  }
}

async function updateAddonAction(request: Request, formData: FormData) {
  const submission = parseWithZod(formData, { schema: updateAddonFormSchema });
  if (submission.status !== "success") {
    return data<AddonActionData>(
      { intent: "update-addon", revalidate: false, submission: submission.reply() },
      { status: HTTP_STATUS.BAD_REQUEST, headers: NO_STORE },
    );
  }

  try {
    const { addonId, description, ...body } = submission.value;
    await updateAdminAddon({
      request,
      addonId,
      body: { ...body, description: description ?? null },
    });
    return data<AddonActionData>(
      { intent: "update-addon", success: "Add-on updated." },
      { headers: NO_STORE },
    );
  } catch (error) {
    const { message, status } = actionError(error, "Unable to update the add-on.");
    return data<AddonActionData>(
      { intent: "update-addon", error: message, submission: submission.reply() },
      { status, headers: NO_STORE },
    );
  }
}

async function createPriceAction(request: Request, formData: FormData) {
  const submission = parseWithZod(formData, { schema: createAddonPriceFormSchema });
  if (submission.status !== "success") {
    return data<AddonActionData>(
      { intent: "create-price", revalidate: false, submission: submission.reply() },
      { status: HTTP_STATUS.BAD_REQUEST, headers: NO_STORE },
    );
  }

  try {
    const { addonId, effectiveSince, effectiveUntil, amount } = submission.value;
    await createAdminAddonPrice({
      request,
      addonId,
      body: {
        amount,
        effectiveSince: toUtcIso(effectiveSince),
        effectiveUntil: effectiveUntil ? toUtcIso(effectiveUntil) : undefined,
      },
    });
    return data<AddonActionData>(
      { intent: "create-price", success: "Price created." },
      { headers: NO_STORE },
    );
  } catch (error) {
    const { message, status } = actionError(error, "Unable to create the price.");
    return data<AddonActionData>(
      { intent: "create-price", error: message, submission: submission.reply() },
      { status, headers: NO_STORE },
    );
  }
}

async function endPriceAction(request: Request, formData: FormData) {
  const submission = endAddonPriceFormSchema.safeParse(Object.fromEntries(formData));
  if (!submission.success) {
    return data<AddonActionData>(
      { intent: "end-price", error: "This price cannot be ended.", revalidate: false },
      { status: HTTP_STATUS.BAD_REQUEST, headers: NO_STORE },
    );
  }

  try {
    await endAdminAddonPrice({ request, ...submission.data });
    return data<AddonActionData>(
      { intent: "end-price", success: "Price ended." },
      { headers: NO_STORE },
    );
  } catch (error) {
    const { message, status } = actionError(error, "Unable to end the price.");
    return data<AddonActionData>(
      { intent: "end-price", error: message },
      { status, headers: NO_STORE },
    );
  }
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();

  switch (formData.get("intent")) {
    case "create-addon":
      return createAddonAction(request, formData);
    case "update-addon":
      return updateAddonAction(request, formData);
    case "create-price":
      return createPriceAction(request, formData);
    case "end-price":
      return endPriceAction(request, formData);
    default:
      throw data(null, { status: HTTP_STATUS.BAD_REQUEST, headers: NO_STORE });
  }
}

export function shouldRevalidate({
  actionResult,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  return (actionResult as AddonActionData | undefined)?.revalidate === false
    ? false
    : defaultShouldRevalidate;
}

export default function AdminAddonRatesRoute({ loaderData }: Route.ComponentProps) {
  return <AdminAddonsPage now={loaderData.now} addons={loaderData.addons} />;
}

export function ErrorBoundary() {
  const revalidator = useRevalidator();

  return (
    <div className="mx-auto flex min-h-80 max-w-lg flex-col items-center justify-center text-center">
      <h2 className="text-xl font-semibold">Unable to load add-ons</h2>
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
