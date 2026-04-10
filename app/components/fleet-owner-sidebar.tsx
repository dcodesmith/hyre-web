import {
  CarIcon,
  CalendarIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MegaphoneIcon,
  UserIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";
import { Link, useLocation } from "react-router";
import { Form } from "~/components/CSRFForm";
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
import { Avatar, AvatarFallback } from "~/components/ui/avatar";

type FleetOwnerSidebarProps = {
  readonly isOwnerDriver: boolean;
  readonly userName: string | null;
  readonly userEmail: string;
  readonly onProfileOpen?: () => void;
} & React.ComponentProps<typeof Sidebar>;

type NavItem = {
  title: string;
  to: string;
  icon: typeof LayoutDashboardIcon;
  exact?: boolean;
  ownerDriverHidden?: boolean;
};

const navItems: NavItem[] = [
  {
    title: "Dashboard",
    to: "/fleet-owner",
    icon: LayoutDashboardIcon,
    exact: true,
  },
  {
    title: "Cars",
    to: "/fleet-owner/cars",
    icon: CarIcon,
  },
  {
    title: "Promotions",
    to: "/fleet-owner/promotions",
    icon: MegaphoneIcon,
  },
  {
    title: "Chauffeurs",
    to: "/fleet-owner/chauffeurs",
    icon: UsersIcon,
    ownerDriverHidden: true,
  },
  {
    title: "Bookings",
    to: "/fleet-owner/bookings",
    icon: CalendarIcon,
  },
  {
    title: "Payout Transactions",
    to: "/fleet-owner/payout-transactions",
    icon: WalletIcon,
  },
];

function getInitials(name: string | null, email: string): string {
  if (name) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return email[0].toUpperCase();
}

export function FleetOwnerSidebar({
  isOwnerDriver,
  userName,
  userEmail,
  onProfileOpen,
  ...props
}: FleetOwnerSidebarProps) {
  const location = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();

  const closeMobileSidebar = () => {
    if (isMobile) setOpenMobile(false);
  };

  const filteredNavItems = navItems.filter((item) => !(isOwnerDriver && item.ownerDriverHidden));

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" className="data-[slot=sidebar-menu-button]:!p-1.5">
              <Link to="/fleet-owner" onClick={closeMobileSidebar}>
                <div className="flex items-center justify-center rounded-md bg-primary text-primary-foreground size-8">
                  <CarIcon className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Fleet Manager</span>
                  <span className="truncate text-xs text-muted-foreground">Dashboard</span>
                </div>
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
              {filteredNavItems.map((item) => {
                const isActive = item.exact
                  ? location.pathname === item.to
                  : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);

                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                      <Link to={item.to} onClick={closeMobileSidebar}>
                        <item.icon />
                        <span>{item.title}</span>
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
              <Avatar className="size-8 rounded-lg">
                <AvatarFallback className="rounded-lg text-xs">
                  {getInitials(userName, userEmail)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-medium">{userName ?? "Fleet Owner"}</span>
                <span className="truncate text-xs text-muted-foreground">{userEmail}</span>
              </div>
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Profile">
              <button
                type="button"
                className="w-full"
                onClick={() => {
                  closeMobileSidebar();
                  onProfileOpen?.();
                }}
              >
                <UserIcon />
                <span>Profile</span>
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <Form method="post" action="/logout">
              <input type="hidden" name="redirectTo" value="/fleet-owner/login" />
              <SidebarMenuButton
                asChild
                tooltip="Log out"
                className="text-muted-foreground hover:text-destructive"
              >
                <button type="submit" className="w-full">
                  <LogOutIcon />
                  <span>Log out</span>
                </button>
              </SidebarMenuButton>
            </Form>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
