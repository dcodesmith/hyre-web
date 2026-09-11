import { useFetcher } from "react-router";

import type { ChauffeurVerificationStatus, FleetOwnerChauffeur } from "~/api/chauffeurs/schema";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { cn } from "~/lib/utils";
import type { ChauffeurActionData } from "./chauffeur-form-schema";

const statusConfig: Record<
  ChauffeurVerificationStatus,
  { readonly label: string; readonly className: string }
> = {
  INVITED: { label: "Invited", className: "bg-blue-50 text-blue-700 ring-blue-600/10" },
  CONSENTED: { label: "Consent complete", className: "bg-blue-50 text-blue-700 ring-blue-600/10" },
  PHONE_VERIFIED: {
    label: "Phone verified",
    className: "bg-amber-50 text-amber-700 ring-amber-600/10",
  },
  IDENTITY_VERIFIED: {
    label: "Identity verified",
    className: "bg-amber-50 text-amber-700 ring-amber-600/10",
  },
  APPROVED: { label: "Verified", className: "bg-green-50 text-green-700 ring-green-600/10" },
};

const invitedDateFormatter = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function StatusBadge({ chauffeur }: { readonly chauffeur: FleetOwnerChauffeur }) {
  const config = statusConfig[chauffeur.status];
  const label = chauffeur.status === "APPROVED" && !chauffeur.isActive ? "Inactive" : config.label;

  return (
    <Badge
      variant="outline"
      className={cn(
        "h-6 rounded-md border-none px-2.5 font-semibold ring-1 ring-inset",
        chauffeur.status === "APPROVED" && !chauffeur.isActive
          ? "bg-gray-50 text-gray-700 ring-gray-600/10"
          : config.className,
      )}
    >
      {label}
    </Badge>
  );
}

function ChauffeurToggle({ chauffeur }: { readonly chauffeur: FleetOwnerChauffeur }) {
  const fetcher = useFetcher<ChauffeurActionData>();

  if (chauffeur.status !== "APPROVED" || !chauffeur.chauffeurId) {
    return <span className="text-xs text-muted-foreground">Verification in progress</span>;
  }

  const pending = fetcher.state !== "idle";
  const error =
    fetcher.data?.intent === "update" && fetcher.data.chauffeurId === chauffeur.chauffeurId
      ? fetcher.data.error
      : undefined;

  return (
    <div className="space-y-1.5">
      <fetcher.Form method="post">
        <input type="hidden" name="intent" value="update" />
        <input type="hidden" name="chauffeurId" value={chauffeur.chauffeurId} />
        <input type="hidden" name="isActive" value={String(!chauffeur.isActive)} />
        <Button
          type="submit"
          variant={chauffeur.isActive ? "outline" : "default"}
          size="sm"
          disabled={pending}
          aria-live="polite"
        >
          {pending ? "Saving…" : chauffeur.isActive ? "Deactivate" : "Activate"}
        </Button>
      </fetcher.Form>
      {error ? (
        <p role="alert" className="max-w-48 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ChauffeurIdentity({ chauffeur }: { readonly chauffeur: FleetOwnerChauffeur }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar>
        {chauffeur.image ? (
          <AvatarImage src={chauffeur.image} alt="" width={32} height={32} />
        ) : null}
        <AvatarFallback>{initials(chauffeur.name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate font-medium">{chauffeur.name}</p>
        <p className="truncate text-sm text-muted-foreground">{chauffeur.email}</p>
      </div>
    </div>
  );
}

export function ChauffeurList({ chauffeurs }: { readonly chauffeurs: FleetOwnerChauffeur[] }) {
  return (
    <>
      <div className="grid gap-3 md:hidden">
        {chauffeurs.map((chauffeur) => (
          <Card key={chauffeur.id} size="sm">
            <CardHeader>
              <CardTitle>
                <ChauffeurIdentity chauffeur={chauffeur} />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="text-sm">{chauffeur.phoneNumber}</p>
                </div>
                <StatusBadge chauffeur={chauffeur} />
              </div>
              <ChauffeurToggle chauffeur={chauffeur} />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="hidden py-0 md:block">
        <Table>
          <TableCaption className="sr-only">Chauffeurs invited to your Tripdly fleet</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Chauffeur</TableHead>
              <TableHead scope="col">Phone</TableHead>
              <TableHead scope="col">Status</TableHead>
              <TableHead scope="col">Invited</TableHead>
              <TableHead scope="col" className="text-right">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {chauffeurs.map((chauffeur) => (
              <TableRow key={chauffeur.id}>
                <TableCell>
                  <ChauffeurIdentity chauffeur={chauffeur} />
                </TableCell>
                <TableCell>{chauffeur.phoneNumber}</TableCell>
                <TableCell>
                  <StatusBadge chauffeur={chauffeur} />
                </TableCell>
                <TableCell>{invitedDateFormatter.format(new Date(chauffeur.invitedAt))}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end">
                    <ChauffeurToggle chauffeur={chauffeur} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
