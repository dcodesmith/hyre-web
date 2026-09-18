import { parseWithZod } from "@conform-to/zod/v4";
import { data, type ShouldRevalidateFunctionArgs, useRevalidator } from "react-router";
import { z } from "zod";
import { AdminReferralProgramPage } from "~/admin/referrals/admin-referral-program-page";
import {
  type ReferralProgramActionData,
  referralProgramFormSchema,
} from "~/admin/referrals/referral-program-form-schema";
import {
  createAdminReferralProgram,
  getAdminReferralProgram,
  getAdminReferralProgramHistory,
  updateAdminReferralProgram,
} from "~/api/admin/referrals/referrals.server";
import { ApiRequestError } from "~/api/api.server";
import { HTTP_STATUS } from "~/api/http-status";
import { Button } from "~/components/ui/button";
import { buildPageMetadata } from "~/seo/metadata";
import type { Route } from "./+types/admin.referrals";

const NO_STORE = { "Cache-Control": "private, no-store" };
const statusFormSchema = z.object({ status: z.enum(["ACTIVE", "PAUSED"]) });

export const meta = () =>
  buildPageMetadata({
    title: "Referral Programme | Tripdly Admin",
    description: "Manage Tripdly customer referral incentives and credit limits.",
    path: "/admin/referrals",
    index: false,
  });

export function headers() {
  return NO_STORE;
}

function programOrNull(request: Request) {
  return getAdminReferralProgram({ request })
    .then((response) => response.data)
    .catch((error: unknown) => {
      if (
        error instanceof ApiRequestError &&
        error.kind === "http" &&
        error.status === HTTP_STATUS.NOT_FOUND
      ) {
        return null;
      }
      throw error;
    });
}

export async function loader({ request }: Route.LoaderArgs) {
  const [program, history] = await Promise.all([
    programOrNull(request),
    getAdminReferralProgramHistory({ request }).then((response) => response.data),
  ]);

  return { program, history };
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

async function saveProgram(request: Request, formData: FormData, intent: "create" | "update") {
  const submission = parseWithZod(formData, { schema: referralProgramFormSchema });
  if (submission.status !== "success") {
    return data<ReferralProgramActionData>(
      { intent, revalidate: false, submission: submission.reply() },
      { status: HTTP_STATUS.BAD_REQUEST, headers: NO_STORE },
    );
  }

  try {
    if (intent === "create") {
      await createAdminReferralProgram({ request, body: submission.value });
    } else {
      await updateAdminReferralProgram({ request, body: submission.value });
    }

    return data<ReferralProgramActionData>(
      {
        intent,
        success:
          intent === "create"
            ? "Referral programme created and activated."
            : "Referral programme updated.",
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    const { message, status } = actionError(error, "Unable to save the referral programme.");
    return data<ReferralProgramActionData>(
      { intent, error: message, submission: submission.reply() },
      { status, headers: NO_STORE },
    );
  }
}

async function changeStatus(request: Request, formData: FormData) {
  const parsed = statusFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return data<ReferralProgramActionData>(
      { intent: "status", error: "Select a valid programme status.", revalidate: false },
      { status: HTTP_STATUS.BAD_REQUEST, headers: NO_STORE },
    );
  }

  try {
    await updateAdminReferralProgram({ request, body: parsed.data });
    return data<ReferralProgramActionData>(
      {
        intent: "status",
        success:
          parsed.data.status === "ACTIVE"
            ? "Referral programme resumed."
            : "Referral programme paused.",
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    const { message, status } = actionError(error, "Unable to change the programme status.");
    return data<ReferralProgramActionData>(
      { intent: "status", error: message, revalidate: false },
      { status, headers: NO_STORE },
    );
  }
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create" || intent === "update") {
    return saveProgram(request, formData, intent);
  }
  if (intent === "status") {
    return changeStatus(request, formData);
  }

  throw data(null, { status: HTTP_STATUS.BAD_REQUEST, headers: NO_STORE });
}

export function shouldRevalidate({
  actionResult,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  return (actionResult as ReferralProgramActionData | undefined)?.revalidate === false
    ? false
    : defaultShouldRevalidate;
}

export default function AdminReferralsRoute({ loaderData }: Route.ComponentProps) {
  return <AdminReferralProgramPage program={loaderData.program} history={loaderData.history} />;
}

export function ErrorBoundary() {
  const revalidator = useRevalidator();

  return (
    <div className="mx-auto flex min-h-80 max-w-lg flex-col items-center justify-center text-center">
      <h2 className="text-xl font-semibold">Unable to load the referral programme</h2>
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
