import type { LoaderFunctionArgs } from "@remix-run/node";
import { Link, Outlet, useLocation, useLoaderData } from "@remix-run/react";
import { ScrollArea, ScrollBar } from "~/components/ui/scroll-area";
import { requireUserWithRole } from "~/utils/server/permissions.server";
import { redirect } from "@remix-run/node";

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
  { to: "/fleet-owner/payout-transactions", label: "Payout Transactions" },
] as const;

export function shouldRevalidate() {
  return true;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Skip auth check for login/verify pages - they should be public
  const isPublicPage = pathname.includes("/login") || pathname.includes("/verify");
  if (isPublicPage) {
    return { isOwnerDriver: false, isPublicPage };
  }

  const user = await requireUserWithRole(request, "fleetOwner");

  // Don't redirect if we're already on the onboarding page
  if (!user.hasOnboarded && !pathname.endsWith("/onboarding")) {
    return redirect("/fleet-owner/onboarding");
  }

  return { isOwnerDriver: user.isOwnerDriver, isPublicPage: false };
}

export default function Dashboard() {
  const { isOwnerDriver, isPublicPage } = useLoaderData<typeof loader>();
  const location = useLocation();

  // Don't show navigation on onboarding, login, or verify pages
  const isOnboardingPage = location.pathname.endsWith("/onboarding");
  const shouldShowNav = !isOnboardingPage && !isPublicPage;

  // Filter out chauffeurs link for owner-drivers
  const filteredNavLinks = navLinks.filter(
    (link) => !(isOwnerDriver && link.to === "/fleet-owner/chauffeurs"),
  );

  // For public pages (login/verify), render without layout
  if (isPublicPage) {
    return <Outlet />;
  }

  return (
    <>
      {shouldShowNav && (
        <div className="relative hidden md:block">
          <ScrollArea className="max-w-[600px] lg:max-w-none">
            <nav className="mb-4 mt-4 flex items-center lg:mt-0">
              {filteredNavLinks.map((link) => (
                <NavLink key={link.to} to={link.to}>
                  {link.label}
                </NavLink>
              ))}
            </nav>

            <ScrollBar orientation="horizontal" className="invisible" />
          </ScrollArea>
        </div>
      )}
      <div className="md:mt-0 mt-4">
        <Outlet />
      </div>
    </>
  );
}
