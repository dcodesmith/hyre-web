import { CarIcon } from "lucide-react";
import { Link, useOutletContext } from "react-router";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import type { FleetOwnerOutletContext } from "./fleet-owner";

export default function FleetOwnerIndex() {
  const user = useOutletContext<FleetOwnerOutletContext>();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 py-8 sm:py-12">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Fleet Manager</p>
        <h2 className="mt-2 wrap-break-word text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Welcome, {user.name ?? "Fleet Owner"}
        </h2>
        <p className="mt-2 break-all text-sm text-muted-foreground">{user.email}</p>
      </div>
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Manage your fleet</CardTitle>
          <CardDescription>View the status, approvals, and pricing for your cars.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link to="/fleet-owner/cars">
              <CarIcon data-icon="inline-start" />
              View cars
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
