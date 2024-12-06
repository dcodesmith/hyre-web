import type { LoaderFunctionArgs } from "@remix-run/node";
import { Link, Outlet, useLocation } from "@remix-run/react";
import { ScrollArea, ScrollBar } from "~/components/ui/scroll-area";
import { requireUserWithRole } from "~/utils/permissions.server";

interface NavLinkProps {
  to: string;
  children: React.ReactNode;
}

function NavLink({ to, children }: NavLinkProps) {
  const location = useLocation();
  const isCurrentPath = location.pathname === to;

  return (
    <Link
      to={to}
      className={`flex h-7 items-center justify-center rounded px-4 text-center text-sm transition-colors hover:text-primary ${
        isCurrentPath
          ? "cursor-not-allowed pointer-events-none bg-muted text-primary font-semibold"
          : "text-muted-foreground"
      }`}
    >
      {children}
    </Link>
  );
}

const navLinks = [
  { to: "/fleet-owner", label: "Dashboard" },
  { to: "/fleet-owner/cars", label: "Cars" },
  { to: "/fleet-owner/chauffeurs", label: "Chauffeurs" },
  { to: "/fleet-owner/bookings", label: "Bookings" },
] as const;

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserWithRole(request, "fleetOwner");

  return null;
}

export default function Dashboard() {
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

          <ScrollBar orientation="horizontal" className="invisible" />
        </ScrollArea>
      </div>
      <Outlet />
    </>
  );
}
