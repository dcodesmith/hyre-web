import {
  BanknoteIcon,
  CarIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  UsersIcon,
  WalletCardsIcon,
} from "lucide-react";
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
  const isCarsActive = location.pathname.startsWith("/admin/cars");
  const isFinancialsActive = location.pathname.startsWith("/admin/financials");
  const isFeesActive = location.pathname === "/admin/fees";
  const isAddonRatesActive = location.pathname === "/admin/addon-rates";
  const isStaffActive = location.pathname === "/admin/staff";

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
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isCarsActive} tooltip="Car reviews">
                  <Link
                    to="/admin/cars"
                    aria-current={isCarsActive ? "page" : undefined}
                    onClick={closeMobileSidebar}
                  >
                    <CarIcon />
                    <span>Car reviews</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isFinancialsActive} tooltip="Financials">
                  <Link
                    to="/admin/financials"
                    aria-current={isFinancialsActive ? "page" : undefined}
                    onClick={closeMobileSidebar}
                  >
                    <WalletCardsIcon aria-hidden="true" />
                    <span>Financials</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {role === "admin" ? (
                <>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isFeesActive} tooltip="Fees and VAT">
                      <Link
                        to="/admin/fees"
                        aria-current={isFeesActive ? "page" : undefined}
                        onClick={closeMobileSidebar}
                      >
                        <BanknoteIcon />
                        <span>Fees and VAT</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isAddonRatesActive} tooltip="Add-on rates">
                      <Link
                        to="/admin/addon-rates"
                        aria-current={isAddonRatesActive ? "page" : undefined}
                        onClick={closeMobileSidebar}
                      >
                        <SlidersHorizontalIcon />
                        <span>Add-on rates</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isStaffActive} tooltip="Staff">
                      <Link
                        to="/admin/staff"
                        aria-current={isStaffActive ? "page" : undefined}
                        onClick={closeMobileSidebar}
                      >
                        <UsersIcon />
                        <span>Staff</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </>
              ) : null}
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
