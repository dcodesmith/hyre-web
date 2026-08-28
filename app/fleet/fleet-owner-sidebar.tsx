import { CarIcon, LayoutDashboardIcon, LogOutIcon, TagIcon } from "lucide-react";
import { Form, Link, useLocation } from "react-router";

import type { User } from "~/auth/user";
import { getUserInitials } from "~/auth/user";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "~/components/ui/sidebar";

const navigation = [
  { label: "Dashboard", to: "/fleet-owner", icon: LayoutDashboardIcon, exact: true },
  { label: "Cars", to: "/fleet-owner/cars", icon: CarIcon, exact: false },
  { label: "Promotions", to: "/fleet-owner/promotions", icon: TagIcon, exact: false },
] as const;

type FleetOwnerSidebarProps = {
  readonly isLoggingOut: boolean;
  readonly user: User;
};

export function FleetOwnerSidebar({ isLoggingOut, user }: FleetOwnerSidebarProps) {
  const location = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();

  function closeMobileSidebar() {
    if (isMobile) {
      setOpenMobile(false);
    }
  }

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg">
              <Link to="/fleet-owner" onClick={closeMobileSidebar}>
                <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <CarIcon />
                </span>
                <span className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-semibold">Fleet Manager</span>
                  <span className="truncate text-xs text-muted-foreground">Tripdly</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => {
                const isActive = item.exact
                  ? location.pathname === item.to
                  : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);

                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                      <Link
                        to={item.to}
                        aria-current={isActive ? "page" : undefined}
                        onClick={closeMobileSidebar}
                      >
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator />
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-2 px-2 py-1.5">
              <Avatar size="sm">
                <AvatarFallback>{getUserInitials(user)}</AvatarFallback>
              </Avatar>
              <span className="grid min-w-0 flex-1 text-left leading-tight">
                <span className="truncate text-sm font-medium">{user.name ?? "Fleet Owner"}</span>
                <span className="truncate text-xs text-muted-foreground">{user.email}</span>
              </span>
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <Form method="post" action="/fleet-owner/logout">
              <SidebarMenuButton
                className="text-muted-foreground hover:text-destructive"
                disabled={isLoggingOut}
                tooltip="Log out"
                type="submit"
              >
                <LogOutIcon />
                <span>{isLoggingOut ? "Logging out…" : "Log out"}</span>
              </SidebarMenuButton>
            </Form>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
