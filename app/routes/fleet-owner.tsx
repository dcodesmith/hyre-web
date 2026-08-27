import { Form, Outlet, useNavigation } from "react-router";

import { requireFleetOwner } from "~/auth/fleet-owner-session.server";
import { BrandLink } from "~/components/layout/brand-link";
import { Button } from "~/components/ui/button";
import { buildPageMetadata } from "~/seo/metadata";
import type { Route } from "./+types/fleet-owner";

export const meta = () =>
  buildPageMetadata({
    title: "Fleet Owner | Tripdly",
    description: "Manage your Tripdly fleet.",
    path: "/fleet-owner",
    index: false,
  });

export function headers() {
  return { "Cache-Control": "private, no-store" };
}

export async function loader({ request }: Route.LoaderArgs) {
  return { user: await requireFleetOwner(request) };
}

export type FleetOwnerOutletContext = Awaited<ReturnType<typeof loader>>["user"];

export default function FleetOwnerLayout({ loaderData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const isLoggingOut =
    navigation.formMethod != null &&
    navigation.formAction != null &&
    new URL(navigation.formAction, "https://tripdly.com").pathname === "/fleet-owner/logout";

  return (
    <div className="min-h-dvh bg-[#F7F5F1] text-[#1A1814]">
      <header className="flex h-17.25 items-center justify-between border-b border-neutral-200 bg-white px-6">
        <BrandLink className="text-[#1A1814]" />
        <Form method="post" action="/fleet-owner/logout">
          <Button type="submit" variant="outline" disabled={isLoggingOut}>
            {isLoggingOut ? "Logging out…" : "Log out"}
          </Button>
        </Form>
      </header>
      <main>
        <Outlet context={loaderData.user} />
      </main>
    </div>
  );
}
