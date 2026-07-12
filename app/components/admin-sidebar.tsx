import {
  BanknoteIcon,
  ChartColumnIcon,
  FileTextIcon,
  GiftIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  ShieldIcon,
  SlidersHorizontalIcon,
  StarIcon,
  UserCogIcon,
  UsersIcon,
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

type AdminSidebarProps = {
  readonly isAdmin: boolean;
  readonly userName: string | null;
  readonly userEmail: string;
} & React.ComponentProps<typeof Sidebar>;

type NavItem = {
  title: string;
  to: string;
  icon: typeof LayoutDashboardIcon;
  exact?: boolean;
  adminOnly?: boolean;
};

const navItems: NavItem[] = [
  {
    title: "Dashboard",
    to: "/admin",
    icon: LayoutDashboardIcon,
    exact: true,
  },
  {
    title: "Reports",
    to: "/admin/reports",
    icon: ChartColumnIcon,
  },
  {
    title: "Fleet Owners",
    to: "/admin/owners",
    icon: UsersIcon,
  },
  {
    title: "Documents",
    to: "/admin/documents",
    icon: FileTextIcon,
  },
  {
    title: "Referrals",
    to: "/admin/referrals",
    icon: GiftIcon,
  },
  {
    title: "Reviews",
    to: "/admin/reviews",
    icon: StarIcon,
    adminOnly: true,
  },
  {
    title: "Staff",
    to: "/admin/staff",
    icon: UserCogIcon,
    adminOnly: true,
  },
  {
    title: "Fees",
    to: "/admin/fees",
    icon: BanknoteIcon,
    adminOnly: true,
  },
  {
    title: "Addon Rates",
    to: "/admin/addon-rates",
    icon: SlidersHorizontalIcon,
    adminOnly: true,
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

export function AdminSidebar({ isAdmin, userName, userEmail, ...props }: AdminSidebarProps) {
  const location = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();

  const closeMobileSidebar = () => {
    if (isMobile) setOpenMobile(false);
  };

  const filteredNavItems = navItems.filter((item) => isAdmin || !item.adminOnly);

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" className="data-[slot=sidebar-menu-button]:!p-1.5">
              <Link to="/admin" onClick={closeMobileSidebar}>
                <div className="flex items-center justify-center rounded-md bg-primary text-primary-foreground size-8">
                  <ShieldIcon className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Admin Console</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {isAdmin ? "Administrator" : "Staff"}
                  </span>
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
                <span className="truncate font-medium">{userName ?? (isAdmin ? "Admin" : "Staff")}</span>
                <span className="truncate text-xs text-muted-foreground">{userEmail}</span>
              </div>
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <Form method="post" action="/logout">
              <input type="hidden" name="redirectTo" value="/admin/login" />
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
