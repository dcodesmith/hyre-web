import {
  Outlet,
  redirect,
  type ShouldRevalidateFunctionArgs,
  useLocation,
  useNavigation,
} from "react-router";

import { getFleetOwnerOnboarding } from "~/api/fleet/onboarding/onboarding.server";
import { requireFleetOwner } from "~/auth/fleet-owner-session.server";
import { Separator } from "~/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "~/components/ui/sidebar";
import { TooltipProvider } from "~/components/ui/tooltip";
import { fleetOwnerContext } from "~/fleet/fleet-owner-context";
import { FleetOwnerSidebar } from "~/fleet/fleet-owner-sidebar";
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

export const middleware: Route.MiddlewareFunction[] = [
  async ({ request, context }) => {
    const user = await requireFleetOwner(request);
    const { data: onboarding } = await getFleetOwnerOnboarding({ request });
    context.set(fleetOwnerContext, { onboarding, user });
  },
];

export function loader({ context, url }: Route.LoaderArgs) {
  const value = context.get(fleetOwnerContext);
  const isOnboarding = url.pathname === "/fleet-owner/onboarding";

  if (value.onboarding.status !== "VERIFIED" && !isOnboarding) {
    throw redirect("/fleet-owner/onboarding");
  }
  if (value.onboarding.status === "VERIFIED" && isOnboarding) {
    throw redirect("/fleet-owner");
  }

  return value;
}

export function shouldRevalidate({
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (currentUrl.pathname === nextUrl.pathname && currentUrl.search !== nextUrl.search) {
    return false;
  }

  return defaultShouldRevalidate;
}

export type FleetOwnerOutletContext = Awaited<ReturnType<typeof loader>>;

function getPageTitle(pathname: string) {
  if (pathname === "/fleet-owner") {
    return "Dashboard";
  }

  if (pathname === "/fleet-owner/cars") {
    return "Cars";
  }

  if (pathname === "/fleet-owner/cars/new") {
    return "Add Car";
  }

  if (pathname.endsWith("/onboarding") && pathname.startsWith("/fleet-owner/cars/")) {
    return "Add Car";
  }

  if (pathname.endsWith("/edit") && pathname.startsWith("/fleet-owner/cars/")) {
    return "Edit car";
  }

  if (pathname.startsWith("/fleet-owner/cars/")) {
    return "Car details";
  }

  if (pathname === "/fleet-owner/promotions") {
    return "Promotions";
  }

  if (pathname === "/fleet-owner/chauffeurs") {
    return "Chauffeurs";
  }

  if (pathname === "/fleet-owner/payout-transactions") {
    return "Payout Transactions";
  }

  return "Fleet Manager";
}

function SkipLink() {
  return (
    <a
      href="#main-content"
      className="fixed top-3 left-3 z-60 -translate-y-20 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg transition-transform focus:translate-y-0 focus:ring-2 focus:ring-ring motion-reduce:transition-none"
    >
      Skip to main content
    </a>
  );
}

export default function FleetOwnerLayout({ loaderData }: Route.ComponentProps) {
  const location = useLocation();
  const navigation = useNavigation();
  const isLoggingOut =
    navigation.formMethod != null &&
    navigation.formAction != null &&
    new URL(navigation.formAction, "https://tripdly.com").pathname === "/fleet-owner/logout";

  if (location.pathname === "/fleet-owner/onboarding") {
    return (
      <>
        <SkipLink />
        <main
          id="main-content"
          tabIndex={-1}
          className="min-h-screen bg-muted/30 px-4 py-8 sm:px-6"
        >
          <Outlet context={loaderData} />
        </main>
      </>
    );
  }

  return (
    <TooltipProvider>
      <SidebarProvider>
        <SkipLink />
        <FleetOwnerSidebar user={loaderData.user} isLoggingOut={isLoggingOut} />
        <SidebarInset>
          <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b bg-background transition-[width,height] ease-linear">
            <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
              <h1 className="text-base font-medium">{getPageTitle(location.pathname)}</h1>
            </div>
          </header>
          <main id="main-content" tabIndex={-1} className="flex-1 p-4 sm:p-6">
            <Outlet context={loaderData} />
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
