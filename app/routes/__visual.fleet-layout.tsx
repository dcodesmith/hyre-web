import { Outlet, useLocation } from "react-router";

import { Separator } from "~/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "~/components/ui/sidebar";
import { TooltipProvider } from "~/components/ui/tooltip";
import { FleetOwnerSidebar } from "~/fleet/fleet-owner-sidebar";

function visualFleetTitle(pathname: string) {
  return pathname.includes("chauffeur") ? "Chauffeurs" : "Add Car";
}

export default function FleetVisualLayout() {
  const location = useLocation();

  return (
    <TooltipProvider>
      <SidebarProvider>
        <FleetOwnerSidebar
          isLoggingOut={false}
          user={{ email: "owner@example.com", name: "Ada Lovelace" }}
        />
        <SidebarInset>
          <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b bg-background transition-[width,height] ease-linear">
            <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
              <h1 className="text-base font-medium">{visualFleetTitle(location.pathname)}</h1>
            </div>
          </header>
          <main id="main-content" tabIndex={-1} className="flex-1 p-4 sm:p-6">
            <Outlet />
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
