import { createContext, Outlet, useLocation, useNavigation } from "react-router";

import { AdminSidebar } from "~/admin/admin-sidebar";
import { requireAdminOrStaff } from "~/auth/admin-session.server";
import { Separator } from "~/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "~/components/ui/sidebar";
import { TooltipProvider } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import { buildPageMetadata } from "~/seo/metadata";
import type { Route } from "./+types/admin";

export const meta = () =>
  buildPageMetadata({
    title: "Admin Console | Tripdly",
    description: "Manage Tripdly operations.",
    path: "/admin",
    index: false,
  });

export function headers() {
  return { "Cache-Control": "private, no-store" };
}

type AdminSession = Awaited<ReturnType<typeof requireAdminOrStaff>>;

const adminSessionContext = createContext<AdminSession>();

export const middleware: Route.MiddlewareFunction[] = [
  async ({ request, context }) => {
    context.set(adminSessionContext, await requireAdminOrStaff(request));
  },
];

export function loader({ context }: Route.LoaderArgs) {
  return context.get(adminSessionContext);
}

export type AdminOutletContext = ReturnType<typeof loader>;

export default function AdminLayout({ loaderData }: Route.ComponentProps) {
  const location = useLocation();
  const navigation = useNavigation();
  const isLoggingOut =
    navigation.formMethod != null &&
    navigation.formAction != null &&
    new URL(navigation.formAction, "https://tripdly.com").pathname === "/admin/logout";
  const isNavigating = navigation.location != null && !isLoggingOut;
  const pageTitle = location.pathname.startsWith("/admin/cars") ? "Car reviews" : "Overview";

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AdminSidebar isLoggingOut={isLoggingOut} role={loaderData.role} user={loaderData.user} />
        <SidebarInset>
          <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b bg-background transition-[width,height] ease-linear">
            <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
              <h1 className="text-base font-medium">{pageTitle}</h1>
              {isNavigating ? (
                <output className="ml-auto text-xs text-muted-foreground">Loading…</output>
              ) : null}
            </div>
          </header>
          <main
            id="main-content"
            tabIndex={-1}
            aria-busy={isNavigating}
            className={cn(
              "flex-1 p-4 transition-opacity sm:p-6",
              isNavigating && "pointer-events-none opacity-60",
            )}
          >
            <Outlet context={loaderData} />
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
