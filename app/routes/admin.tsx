import { createContext, Outlet, useNavigation } from "react-router";

import { AdminSidebar } from "~/admin/admin-sidebar";
import { requireAdminOrStaff } from "~/auth/admin-session.server";
import { Separator } from "~/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "~/components/ui/sidebar";
import { TooltipProvider } from "~/components/ui/tooltip";
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

export type AdminOutletContext = Awaited<ReturnType<typeof loader>>;

export default function AdminLayout({ loaderData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const isLoggingOut =
    navigation.formMethod != null &&
    navigation.formAction != null &&
    new URL(navigation.formAction, "https://tripdly.com").pathname === "/admin/logout";

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AdminSidebar isLoggingOut={isLoggingOut} role={loaderData.role} user={loaderData.user} />
        <SidebarInset>
          <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center border-b bg-background">
            <div className="flex w-full items-center gap-2 px-4 lg:px-6">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="h-4" />
              <h1 className="text-sm font-medium">Overview</h1>
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
