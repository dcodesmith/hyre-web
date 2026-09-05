import { parseWithZod } from "@conform-to/zod/v4";
import { data, redirect, type ShouldRevalidateFunctionArgs, useRevalidator } from "react-router";
import { z } from "zod";

import { AdminStaffPage } from "~/admin/staff/admin-staff-page";
import { type StaffActionData, staffFormSchema } from "~/admin/staff/staff-form-schema";
import { parseStaffQuery, serializeStaffQuery } from "~/admin/staff/staff-url";
import {
  createAdminStaff,
  getAdminStaff,
  reinstateAdminStaff,
  revokeAdminStaff,
} from "~/api/admin/staff/staff.server";
import { ApiRequestError } from "~/api/api.server";
import { HTTP_STATUS } from "~/api/http-status";
import { requireAdminContext } from "~/auth/admin-context.server";
import { Button } from "~/components/ui/button";
import { buildPageMetadata } from "~/seo/metadata";
import type { Route } from "./+types/admin.staff";

const NO_STORE = { "Cache-Control": "private, no-store" };
const CUID_PATTERN = /^[cC][0-9a-z]{6,}$/;

export const meta = () =>
  buildPageMetadata({
    title: "Staff | Tripdly Admin",
    description: "Manage Tripdly staff access.",
    path: "/admin/staff",
    index: false,
  });

export function headers() {
  return NO_STORE;
}

export const middleware: Route.MiddlewareFunction[] = [
  ({ context }) => requireAdminContext(context),
];

export async function loader({ request }: Route.LoaderArgs) {
  const query = parseStaffQuery(new URL(request.url).searchParams);
  const { data: response } = await getAdminStaff({ request, ...query });
  if (response.meta.totalPages > 0 && query.page > response.meta.totalPages) {
    const search = serializeStaffQuery({
      ...query,
      page: response.meta.totalPages,
    }).toString();
    throw redirect(search ? `/admin/staff?${search}` : "/admin/staff");
  }

  return { ...response, query };
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

async function createStaffAction(request: Request, formData: FormData) {
  const submission = parseWithZod(formData, { schema: staffFormSchema });

  if (submission.status !== "success") {
    return data<StaffActionData>(
      { intent: "create", revalidate: false, submission: submission.reply() },
      { status: HTTP_STATUS.BAD_REQUEST, headers: NO_STORE },
    );
  }

  try {
    await createAdminStaff({
      request,
      body: submission.value,
    });
    return data<StaffActionData>(
      {
        intent: "create",
        success: "Staff member added.",
        submission: submission.reply({ resetForm: true }),
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    const { message, status } = actionError(
      error,
      "Unable to add this staff member. Please try again.",
    );
    return data<StaffActionData>(
      { intent: "create", error: message, submission: submission.reply() },
      { status, headers: NO_STORE },
    );
  }
}

async function updateStaffAccessAction(
  request: Request,
  formData: FormData,
  intent: "revoke" | "reinstate",
) {
  const staffId = z.string().regex(CUID_PATTERN).safeParse(formData.get("staffId"));
  if (!staffId.success) {
    return data<StaffActionData>(
      { intent, error: "This staff member could not be identified.", revalidate: false },
      { status: HTTP_STATUS.BAD_REQUEST, headers: NO_STORE },
    );
  }

  try {
    if (intent === "revoke") {
      await revokeAdminStaff(request, staffId.data);
    } else {
      await reinstateAdminStaff(request, staffId.data);
    }
    return data<StaffActionData>(
      {
        intent,
        success: intent === "revoke" ? "Staff access revoked." : "Staff access reinstated.",
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    const { message, status } = actionError(
      error,
      intent === "revoke"
        ? "Unable to revoke this staff member. Please try again."
        : "Unable to reinstate this staff member. Please try again.",
    );
    return data<StaffActionData>({ intent, error: message }, { status, headers: NO_STORE });
  }
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");
  if (intent === "create") {
    return createStaffAction(request, formData);
  }
  if (intent === "revoke" || intent === "reinstate") {
    return updateStaffAccessAction(request, formData, intent);
  }

  return data<StaffActionData>(
    { intent: "create", error: "Invalid staff action.", revalidate: false },
    { status: HTTP_STATUS.BAD_REQUEST, headers: NO_STORE },
  );
}

export function shouldRevalidate({
  actionResult,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if ((actionResult as StaffActionData | undefined)?.revalidate === false) {
    return false;
  }
  return defaultShouldRevalidate;
}

export default function AdminStaffRoute({ loaderData }: Route.ComponentProps) {
  return (
    <AdminStaffPage staff={loaderData.staff} meta={loaderData.meta} query={loaderData.query} />
  );
}

export function ErrorBoundary() {
  const revalidator = useRevalidator();

  return (
    <div className="mx-auto flex min-h-80 max-w-lg flex-col items-center justify-center text-center">
      <h2 className="text-xl font-semibold">Unable to load staff</h2>
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
