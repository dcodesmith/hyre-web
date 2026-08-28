import { redirect, useRevalidator } from "react-router";

import { AdminFinancialsPage } from "~/admin/financials/admin-financials-page";
import {
  adminFinancialsPath,
  FINANCIALS_PAGE_SIZE,
  parseFinancialsView,
} from "~/admin/financials/financials-url";
import { getAdminPayouts, getAdminRefunds } from "~/api/admin/financials/financials.server";
import { Button } from "~/components/ui/button";
import { buildPageMetadata } from "~/seo/metadata";
import type { Route } from "./+types/admin.financials";

export const meta = () =>
  buildPageMetadata({
    title: "Financials | Tripdly Admin",
    description: "Review Tripdly refund and payout operations.",
    path: "/admin/financials",
    index: false,
  });

export function headers() {
  return { "Cache-Control": "private, no-store" };
}

export async function loader({ request }: Route.LoaderArgs) {
  const view = parseFinancialsView(new URL(request.url).searchParams);
  if (view.kind === "refunds") {
    const { data } = await getAdminRefunds({
      request,
      attentionOnly: view.attentionOnly,
      page: view.page,
      limit: FINANCIALS_PAGE_SIZE,
      status: view.status,
    });
    if (data.meta.totalPages > 0 && view.page > data.meta.totalPages) {
      throw redirect(adminFinancialsPath({ ...view, page: data.meta.totalPages }));
    }
    return { view, items: data.refunds, meta: data.meta };
  }

  const { data } = await getAdminPayouts({
    request,
    attentionOnly: view.attentionOnly,
    page: view.page,
    limit: FINANCIALS_PAGE_SIZE,
    status: view.status,
  });
  if (data.meta.totalPages > 0 && view.page > data.meta.totalPages) {
    throw redirect(adminFinancialsPath({ ...view, page: data.meta.totalPages }));
  }
  return { view, items: data.payouts, meta: data.meta };
}

export default function AdminFinancialsRoute({ loaderData }: Route.ComponentProps) {
  return (
    <AdminFinancialsPage view={loaderData.view} items={loaderData.items} meta={loaderData.meta} />
  );
}

export function ErrorBoundary() {
  const revalidator = useRevalidator();

  return (
    <div className="mx-auto flex min-h-80 max-w-lg flex-col items-center justify-center text-center">
      <h2 className="text-xl font-semibold">Unable to load financial operations</h2>
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
