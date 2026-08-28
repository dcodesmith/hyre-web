import { LayoutDashboardIcon, LogOutIcon, ShieldCheckIcon } from "lucide-react";
import { Form, Link, useLocation } from "react-router";

import type { AdminPortalRole } from "~/auth/auth-form-schema";
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

type AdminSidebarProps = {
  readonly isLoggingOut: boolean;
  readonly role: AdminPortalRole;
  readonly user: User;
};

export function AdminSidebar({ isLoggingOut, role, user }: AdminSidebarProps) {
  const location = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();
  const isOverviewActive = location.pathname === "/admin";

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
              <Link to="/admin" onClick={closeMobileSidebar}>
                <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <ShieldCheckIcon />
                </span>
                <span className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-semibold">Admin Console</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {role === "admin" ? "Administrator" : "Staff"}
                  </span>
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
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isOverviewActive} tooltip="Overview">
                  <Link
                    to="/admin"
                    aria-current={isOverviewActive ? "page" : undefined}
                    onClick={closeMobileSidebar}
                  >
                    <LayoutDashboardIcon />
                    <span>Overview</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
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
                <span className="truncate text-sm font-medium">
                  {user.name ?? (role === "admin" ? "Administrator" : "Staff")}
                </span>
                <span className="truncate text-xs text-muted-foreground">{user.email}</span>
              </span>
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <Form method="post" action="/admin/logout">
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
