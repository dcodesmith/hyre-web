import { useOutletContext } from "react-router";

import { Badge } from "~/components/ui/badge";
import type { AdminOutletContext } from "./admin";

export function headers() {
  return { "Cache-Control": "private, no-store" };
}

export default function AdminIndex() {
  const { role, user } = useOutletContext<AdminOutletContext>();
  const displayName = user.name?.trim() || (role === "admin" ? "Administrator" : "Staff");

  return (
    <section className="mx-auto flex min-h-[calc(100dvh-7rem)] max-w-3xl items-center">
      <div className="w-full rounded-xl border bg-card p-6 shadow-sm sm:p-8">
        <Badge variant="secondary">{role === "admin" ? "Administrator" : "Staff"}</Badge>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
          Welcome back, {displayName}
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
          Your Tripdly operations workspace is ready.
        </p>
      </div>
    </section>
  );
}
