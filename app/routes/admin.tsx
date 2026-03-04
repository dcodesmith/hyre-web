import { LoaderFunctionArgs } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useLocation } from "@remix-run/react";
import { ScrollArea } from "~/components/ui/scroll-area";
import { requireAdminOrStaffWithRedirect } from "~/modules/auth/auth.server";

interface NavLinkProps {
  readonly to: string;
  readonly children: React.ReactNode;
}

function NavLink({ to, children }: NavLinkProps) {
  const location = useLocation();
  const isCurrentPath = location.pathname === to;

  return (
    <Link
      to={to}
      className={`flex h-7 items-center justify-center rounded px-4 text-center text-sm transition-colors hover:text-primary ${
        isCurrentPath ? "bg-muted text-primary font-semibold" : "text-muted-foreground"
      }`}
    >
      {children}
    </Link>
  );
}

const adminNavLinks = [
  { to: "/admin", label: "Dashboard" },
  { to: "/admin/owners", label: "Fleet Owners" },
  { to: "/admin/documents", label: "Documents" },
  { to: "/admin/referrals", label: "Referrals" },
  { to: "/admin/reviews", label: "Reviews" },
  { to: "/admin/staff", label: "Staff" },
  { to: "/admin/fees", label: "Fees" },
  { to: "/admin/addon-rates", label: "Addon Rates" },
] as const;

const staffNavLinks = [
  { to: "/admin", label: "Dashboard" },
  { to: "/admin/owners", label: "Fleet Owners" },
  { to: "/admin/documents", label: "Documents" },
  { to: "/admin/referrals", label: "Referrals" },
] as const;

export async function loader({ request }: LoaderFunctionArgs) {
  // Skip authentication for login route
  const url = new URL(request.url);
  if (url.pathname === "/admin/login" || url.pathname === "/admin/verify") {
    return { isStaff: false, isAdmin: false };
  }

  const { isStaff, isAdmin } = await requireAdminOrStaffWithRedirect(request);

  return { isStaff, isAdmin };
}

export default function AdminLayout() {
  const { isStaff, isAdmin } = useLoaderData<typeof loader>();
  const location = useLocation();
  const isLoginPage = location.pathname === "/admin/login" || location.pathname === "/admin/verify";

  // Don't show nav on login/verify pages
  if (isLoginPage) {
    return <Outlet />;
  }

  const navLinks = isStaff && !isAdmin ? staffNavLinks : adminNavLinks;

  return (
    <>
      <div className="relative">
        <ScrollArea className="max-w-[600px] lg:max-w-none">
          <nav className="mb-4 flex items-center">
            {navLinks.map((link) => (
              <NavLink key={link.to} to={link.to}>
                {link.label}
              </NavLink>
            ))}
          </nav>
        </ScrollArea>
      </div>
      <Outlet />
    </>
  );
}
