import {
  createContext,
  Outlet,
  type ShouldRevalidateFunctionArgs,
  useLocation,
  useNavigation,
} from "react-router";

import { requireFleetOwner } from "~/auth/fleet-owner-session.server";
import { Separator } from "~/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "~/components/ui/sidebar";
import { TooltipProvider } from "~/components/ui/tooltip";
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

type FleetOwnerUser = Awaited<ReturnType<typeof requireFleetOwner>>;

const fleetOwnerContext = createContext<FleetOwnerUser>();

export const middleware: Route.MiddlewareFunction[] = [
  async ({ request, context }) => {
    context.set(fleetOwnerContext, await requireFleetOwner(request));
  },
];

export function loader({ context }: Route.LoaderArgs) {
  return { user: context.get(fleetOwnerContext) };
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

export type FleetOwnerOutletContext = Awaited<ReturnType<typeof loader>>["user"];

function getPageTitle(pathname: string) {
  if (pathname === "/fleet-owner") {
    return "Dashboard";
  }

  if (pathname === "/fleet-owner/cars") {
    return "Cars";
  }

  if (pathname.startsWith("/fleet-owner/cars/")) {
    return "Car details";
  }

  if (pathname === "/fleet-owner/promotions") {
    return "Promotions";
  }

  return "Fleet Manager";
}

export default function FleetOwnerLayout({ loaderData }: Route.ComponentProps) {
  const location = useLocation();
  const navigation = useNavigation();
  const isLoggingOut =
    navigation.formMethod != null &&
    navigation.formAction != null &&
    new URL(navigation.formAction, "https://tripdly.com").pathname === "/fleet-owner/logout";

  return (
    <TooltipProvider>
      <SidebarProvider>
        <FleetOwnerSidebar user={loaderData.user} isLoggingOut={isLoggingOut} />
        <SidebarInset>
          <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center border-b bg-background">
            <div className="flex w-full items-center gap-2 px-4 lg:px-6">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="h-4" />
              <h1 className="text-sm font-medium">{getPageTitle(location.pathname)}</h1>
            </div>
          </header>
          <div className="flex-1 p-4 sm:p-6">
            <Outlet context={loaderData.user} />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
