import { type LoaderFunctionArgs, useLoaderData, Link } from "react-router";
import { requireAdminOrStaffWithRedirect } from "~/modules/auth/auth.server";
import { prisma } from "~/modules/db/db.server";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireAdminOrStaffWithRedirect(request);
  const id = params.id as string;
  const attribution = await prisma.referralAttribution.findUnique({
    where: { id },
    include: {
      referee: { select: { id: true, name: true, email: true, createdAt: true } },
      referrer: { select: { id: true, name: true, email: true } },
    },
  });
  if (!attribution) throw new Response("Not found", { status: 404 });
  return { attribution };
}

export default function AttributionDetails() {
  const { attribution } = useLoaderData<typeof loader>();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button asChild variant="outline" size="sm">
          <Link to="/admin/referrals/attributions">Back</Link>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Attribution Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 text-sm">
            <div>
              <span className="font-medium">Code:</span> <code>{attribution.referralCode}</code>
            </div>
            <div>
              <span className="font-medium">Source:</span> {attribution.source}
            </div>
            <div>
              <span className="font-medium">Referee:</span>{" "}
              {attribution.referee.name || attribution.referee.email}
            </div>
            <div>
              <span className="font-medium">Referrer:</span>{" "}
              {attribution.referrer.name || attribution.referrer.email}
            </div>
            <div>
              <span className="font-medium">IP:</span> {attribution.ipAddress || "Unknown"}
            </div>
            <div>
              <span className="font-medium">User-Agent:</span> {attribution.userAgent || "Unknown"}
            </div>
            <div>
              <span className="font-medium">Created:</span>{" "}
              {new Date(attribution.createdAt).toLocaleString()}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
