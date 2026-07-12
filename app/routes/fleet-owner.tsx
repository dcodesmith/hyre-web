import { useCallback, useState } from "react";
import {
  type LoaderFunctionArgs,
  type ShouldRevalidateFunctionArgs,
  Outlet,
  useLocation,
  useLoaderData,
  redirect,
} from "react-router";
import { Separator } from "~/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "~/components/ui/sidebar";
import { FleetOwnerSidebar } from "~/components/fleet-owner-sidebar";
import { ProfileFormSheet } from "~/components/forms/ProfileFormSheet";
import { requireUserWithRole } from "~/utils/server/permissions.server";

export function shouldRevalidate({
  formAction,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (formAction) return true;
  return defaultShouldRevalidate;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  const isPublicPage =
    pathname.startsWith("/fleet-owner/login") ||
    pathname.startsWith("/fleet-owner/verify");
  if (isPublicPage) {
    return {
      isOwnerDriver: false,
      isPublicPage,
      userName: null,
      userEmail: "",
      user: null,
    };
  }

  const user = await requireUserWithRole(request, "fleetOwner");

  if (!user.hasOnboarded && !pathname.endsWith("/onboarding")) {
    return redirect("/fleet-owner/onboarding");
  }

  return {
    isOwnerDriver: user.isOwnerDriver,
    isPublicPage: false,
    userName: user.name ?? null,
    userEmail: user.email,
    user,
  };
}

const pageTitles: Record<string, string> = {
  "/fleet-owner": "Dashboard",
  "/fleet-owner/cars": "Cars",
  "/fleet-owner/promotions": "Promotions",
  "/fleet-owner/chauffeurs": "Chauffeurs",
  "/fleet-owner/bookings": "Bookings",
  "/fleet-owner/payout-transactions": "Payout Transactions",
  "/fleet-owner/onboarding": "Onboarding",
};

function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];
  const sortedRoutes = Object.entries(pageTitles).sort(([a], [b]) => b.length - a.length);
  for (const [route, title] of sortedRoutes) {
    // "/fleet-owner" only matches exactly (handled above); as a prefix it would
    // swallow every unmapped sub-route and make the fallback unreachable
    if (route !== "/fleet-owner" && pathname.startsWith(`${route}/`)) return title;
  }
  return "Fleet Manager";
}

export default function FleetOwnerLayout() {
  const { isOwnerDriver, isPublicPage, userName, userEmail, user } = useLoaderData<typeof loader>();
  const location = useLocation();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const handleProfileOpen = useCallback(() => {
    setIsProfileOpen(true);
  }, []);

  const handleProfileOpenChange = useCallback((open: boolean) => {
    setIsProfileOpen(open);
  }, []);

  const isOnboardingPage = location.pathname.endsWith("/onboarding");
  const shouldShowSidebar = !isOnboardingPage && !isPublicPage;

  if (!shouldShowSidebar) {
    return <Outlet />;
  }

  const pageTitle = getPageTitle(location.pathname);

  return (
    <SidebarProvider>
      <FleetOwnerSidebar
        isOwnerDriver={isOwnerDriver}
        userName={userName}
        userEmail={userEmail}
        onProfileOpen={handleProfileOpen}
      />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear">
          <div className="flex w-full items-center gap-2 px-4 lg:px-6">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
            <h1 className="text-base font-medium">{pageTitle}</h1>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-4 lg:p-6">
          <Outlet />
        </div>
      </SidebarInset>
      <ProfileFormSheet open={isProfileOpen} onOpenChange={handleProfileOpenChange} user={user} />
    </SidebarProvider>
  );
}
