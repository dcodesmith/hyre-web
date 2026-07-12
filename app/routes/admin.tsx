import { type LoaderFunctionArgs, Outlet, useLoaderData, useLocation } from "react-router";
import { Separator } from "~/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "~/components/ui/sidebar";
import { AdminSidebar } from "~/components/admin-sidebar";
import { requireAdminOrStaffWithRedirect } from "~/modules/auth/auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  // Skip authentication for login route
  const url = new URL(request.url);
  if (url.pathname === "/admin/login" || url.pathname === "/admin/verify") {
    return { isStaff: false, isAdmin: false, userName: null, userEmail: "" };
  }

  const { user, isStaff, isAdmin } = await requireAdminOrStaffWithRedirect(request);

  return { isStaff, isAdmin, userName: user.name ?? null, userEmail: user.email };
}

const pageTitles: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/reports": "Reports",
  "/admin/owners": "Fleet Owners",
  "/admin/documents": "Documents",
  "/admin/referrals": "Referrals",
  "/admin/reviews": "Reviews",
  "/admin/staff": "Staff",
  "/admin/fees": "Fees",
  "/admin/addon-rates": "Addon Rates",
};

function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];
  const sortedRoutes = Object.entries(pageTitles).sort(([a], [b]) => b.length - a.length);
  for (const [route, title] of sortedRoutes) {
    // "/admin" only matches exactly (handled above); as a prefix it would
    // swallow every unmapped sub-route and make the fallback unreachable
    if (route !== "/admin" && pathname.startsWith(`${route}/`)) return title;
  }
  return "Admin Console";
}

export default function AdminLayout() {
  const { isAdmin, userName, userEmail } = useLoaderData<typeof loader>();
  const location = useLocation();
  const isLoginPage = location.pathname === "/admin/login" || location.pathname === "/admin/verify";

  // Don't show sidebar on login/verify pages
  if (isLoginPage) {
    return <Outlet />;
  }

  const pageTitle = getPageTitle(location.pathname);

  return (
    <SidebarProvider>
      <AdminSidebar isAdmin={isAdmin} userName={userName} userEmail={userEmail} />
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
    </SidebarProvider>
  );
}
