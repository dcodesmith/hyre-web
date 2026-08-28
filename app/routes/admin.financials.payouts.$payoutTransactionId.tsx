import { data, isRouteErrorResponse, Link, useOutletContext, useRouteError } from "react-router";

import { AdminPayoutDetailPage } from "~/admin/financials/admin-payout-detail";
import {
  type FinancialActionData,
  reconcilePayoutFormSchema,
} from "~/admin/financials/financial-action-schema";
import { parseFinancialsView } from "~/admin/financials/financials-url";
import { getAdminPayout, reconcileAdminPayout } from "~/api/admin/financials/financials.server";
import { ApiRequestError } from "~/api/api.server";
import { HTTP_STATUS } from "~/api/http-status";
import { requireAdminContext } from "~/auth/admin-context.server";
import { Button } from "~/components/ui/button";
import { buildPageMetadata } from "~/seo/metadata";
import type { Route } from "./+types/admin.financials.payouts.$payoutTransactionId";
import type { AdminOutletContext } from "./admin";

const NO_STORE = { "Cache-Control": "private, no-store" };

export const meta = ({ loaderData }: Route.MetaArgs) =>
  buildPageMetadata({
    title: loaderData?.payout
      ? `Payout ${loaderData.payout.id} | Tripdly Admin`
      : "Payout | Tripdly Admin",
    description: "Review and reconcile a Tripdly payout.",
    path: loaderData?.payout
      ? `/admin/financials/payouts/${loaderData.payout.id}`
      : "/admin/financials",
    index: false,
  });

export function headers() {
  return NO_STORE;
}

export const middleware: Route.MiddlewareFunction[] = [
  ({ request, context }) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      requireAdminContext(context);
    }
  },
];

export async function loader({ request, params }: Route.LoaderArgs) {
  try {
    const { data: payout } = await getAdminPayout({
      request,
      payoutTransactionId: params.payoutTransactionId,
    });
    const parsedView = parseFinancialsView(new URL(request.url).searchParams);
    const view =
      parsedView.kind === "payouts"
        ? parsedView
        : { kind: "payouts" as const, page: 1, attentionOnly: parsedView.attentionOnly };
    return { payout, view };
  } catch (error) {
    if (
      error instanceof ApiRequestError &&
      (error.status === HTTP_STATUS.BAD_REQUEST || error.status === HTTP_STATUS.NOT_FOUND)
    ) {
      throw data(null, { status: HTTP_STATUS.NOT_FOUND });
    }
    throw error;
  }
}

export async function action({ request, params }: Route.ActionArgs) {
  const formData = await request.formData();
  const submission = reconcilePayoutFormSchema.safeParse(Object.fromEntries(formData));
  if (!submission.success) {
    return data<FinancialActionData>(
      { error: submission.error.issues[0]?.message ?? "Invalid reconciliation request." },
      { status: HTTP_STATUS.BAD_REQUEST, headers: NO_STORE },
    );
  }

  try {
    const { data: result } = await reconcileAdminPayout({
      request,
      payoutTransactionId: params.payoutTransactionId,
    });
    return data<FinancialActionData>(
      {
        success: result.reconciled
          ? "Payout reconciled with the provider."
          : `Provider check completed. The payout remains ${result.status.toLowerCase().replaceAll("_", " ")}.`,
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    if (error instanceof ApiRequestError && error.kind === "aborted") {
      throw error;
    }
    const status = error instanceof ApiRequestError ? error.status : HTTP_STATUS.BAD_GATEWAY;
    const message =
      error instanceof ApiRequestError && error.status < HTTP_STATUS.INTERNAL_SERVER_ERROR
        ? error.problem.detail
        : "Unable to reconcile this payout. Please try again.";
    return data<FinancialActionData>({ error: message }, { status, headers: NO_STORE });
  }
}

export default function AdminPayoutRoute({ loaderData }: Route.ComponentProps) {
  const { role } = useOutletContext<AdminOutletContext>();
  return <AdminPayoutDetailPage payout={loaderData.payout} role={role} view={loaderData.view} />;
}

export function ErrorBoundary() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === HTTP_STATUS.NOT_FOUND;

  return (
    <div className="mx-auto flex min-h-80 max-w-lg flex-col items-center justify-center text-center">
      <h2 className="text-xl font-semibold">
        {notFound ? "Payout not found" : "Unable to load this payout"}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {notFound ? "This payout is not available." : "Please return to financials and try again."}
      </p>
      <Button asChild className="mt-5">
        <Link to="/admin/financials">Back to financials</Link>
      </Button>
    </div>
  );
}
