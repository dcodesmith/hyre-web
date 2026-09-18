import { GiftIcon, PauseIcon, PlayIcon } from "lucide-react";
import { useFetcher } from "react-router";
import type {
  ReferralIncentive,
  ReferralProgram,
  ReferralProgramHistory,
} from "~/api/admin/referrals/schema";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { formatCurrency } from "~/money/currency";
import { ReferralProgramForm } from "./referral-program-form";
import type { ReferralProgramActionData } from "./referral-program-form-schema";

const dateTimeFormatter = new Intl.DateTimeFormat("en-NG", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Lagos",
});

function describeIncentive(incentive: ReferralIncentive) {
  return incentive.type === "FIXED"
    ? formatCurrency(incentive.amount)
    : `${incentive.percentage}% up to ${formatCurrency(incentive.maxAmount)}`;
}

function CurrentProgramme({ program }: { readonly program: ReferralProgram }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GiftIcon aria-hidden="true" className="size-5" />
          Current programme
        </CardTitle>
        <CardDescription>
          Last updated {dateTimeFormatter.format(new Date(program.updatedAt))}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">New customer discount</dt>
            <dd className="mt-1 font-semibold">{describeIncentive(program.refereeDiscount)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Referrer reward</dt>
            <dd className="mt-1 font-semibold">{describeIncentive(program.referrerReward)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Minimum booking</dt>
            <dd className="mt-1 font-semibold">{formatCurrency(program.minimumBookingAmount)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Credit use cap</dt>
            <dd className="mt-1 font-semibold">
              Lower of {formatCurrency(program.maxCreditsPerBookingAmount)} or{" "}
              {program.maxCreditsPerBookingPercent}%
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

function ProgrammeHistory({ history }: { readonly history: ReferralProgramHistory }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent changes</CardTitle>
        <CardDescription>
          Showing {history.data.length} of {history.pagination.totalItems} audit entries.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {history.data.length > 0 ? (
          <ol className="divide-y">
            {history.data.map((entry) => (
              <li key={entry.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                <div>
                  <p className="font-medium">
                    {entry.action === "CREATED"
                      ? "Programme created"
                      : entry.action === "STATUS_CHANGED"
                        ? `Status changed to ${entry.after.status.toLowerCase()}`
                        : "Programme settings updated"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">By staff ID {entry.actorId}</p>
                </div>
                <time className="text-xs text-muted-foreground" dateTime={entry.createdAt}>
                  {dateTimeFormatter.format(new Date(entry.createdAt))}
                </time>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">No programme changes yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

function StatusAction({ program }: { readonly program: ReferralProgram }) {
  const fetcher = useFetcher<ReferralProgramActionData>();
  const nextStatus = program.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
  const isActive = program.status === "ACTIVE";

  return (
    <div className="space-y-3">
      <fetcher.Form method="post">
        <input type="hidden" name="intent" value="status" />
        <input type="hidden" name="status" value={nextStatus} />
        <Button
          type="submit"
          variant={isActive ? "outline" : "default"}
          disabled={fetcher.state !== "idle"}
        >
          {isActive ? <PauseIcon aria-hidden="true" /> : <PlayIcon aria-hidden="true" />}
          {fetcher.state !== "idle"
            ? "Updating…"
            : isActive
              ? "Pause programme"
              : "Resume programme"}
        </Button>
      </fetcher.Form>
      {fetcher.data?.error || fetcher.data?.success ? (
        <Alert variant={fetcher.data.error ? "destructive" : "default"}>
          <AlertTitle>{fetcher.data.error ? "Status not changed" : "Status changed"}</AlertTitle>
          <AlertDescription>{fetcher.data.error ?? fetcher.data.success}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

export function AdminReferralProgramPage({
  program,
  history,
}: {
  readonly program: ReferralProgram | null;
  readonly history: ReferralProgramHistory;
}) {
  return (
    <section
      className="mx-auto flex w-full max-w-6xl flex-col gap-6"
      aria-labelledby="referrals-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 id="referrals-heading" className="text-2xl font-semibold tracking-tight">
              Referral programme
            </h2>
            <Badge variant={program?.status === "ACTIVE" ? "default" : "secondary"}>
              {program?.status ?? "NOT CONFIGURED"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure customer discounts, referrer rewards and booking-credit limits.
          </p>
        </div>
        {program ? <StatusAction program={program} /> : null}
      </div>

      {program ? <CurrentProgramme program={program} /> : null}
      <ReferralProgramForm key={program?.updatedAt ?? "new"} program={program} />
      <ProgrammeHistory history={history} />
    </section>
  );
}
