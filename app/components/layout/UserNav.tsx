import type { Role, User } from "@prisma/client";
import { Link, useLocation } from "@remix-run/react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { userHasRole } from "~/utils/shared/roles";
import { ProfileFormModal } from "../forms/ProfileFormModal";
import { Form } from "~/components/CSRFForm";

type AuthSectionProps = {
  readonly user: (User & { roles: Pick<Role, "name">[] }) | null;
  readonly isHomeRoute: boolean;
  readonly onProfileOpen: () => void;
};

function AuthSection({ user, isHomeRoute, onProfileOpen }: AuthSectionProps) {
  if (user) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className={`relative h-8 w-8 rounded-full border flex items-center justify-center capitalize italic md:hover:bg-transparent md:hover:text-white ${
              isHomeRoute ? "text-white" : "text-black"
            }`}
            aria-label="Open profile menu"
          >
            {getInitials(user)}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" forceMount>
          <>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user.name ?? user.username}</p>
                {user.email && (
                  <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={onProfileOpen}>Profile</DropdownMenuItem>
              <DropdownMenuItem asChild>
                {!userHasRole(user, "fleetOwner") ? (
                  <Link to="/bookings">Bookings</Link>
                ) : (
                  <Link to="/fleet-owner">Dashboard</Link>
                )}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Form method="post" action="/logout">
                <button type="submit" className="w-full text-left">
                  Log out
                </button>
              </Form>
            </DropdownMenuItem>
          </>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Link to="/auth">
      <Button
        variant="outline"
        size="sm"
        // className={`flex border items-center justify-center md:hover:bg-transparent md:hover:text-white ${
        //   isHomeRoute ? "text-white" : "text-black"
        // }`}
      >
        Register or Log in
      </Button>
    </Link>
  );
}

function getInitials(user: (User & { roles: Pick<Role, "name">[] }) | null): string {
  if (!user) return "U";

  if (user.name) {
    const nameParts = user.name
      .trim()
      .split(/\s+/)
      .filter((part) => part.length > 0);

    if (nameParts.length > 1) {
      const lastPart = nameParts.at(-1);
      return (nameParts[0][0] + (lastPart?.[0] ?? "")).toUpperCase();
    }

    if (nameParts.length > 0) {
      return nameParts[0][0].toUpperCase();
    }
  }

  if (user.username && user.username.length > 0) {
    return user.username[0].toUpperCase();
  }

  return "U";
}

type UserNavProps = {
  readonly user: (User & { roles: Pick<Role, "name">[] }) | null;
};

export function UserNav({ user }: UserNavProps) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/admin");
  const isHomeRoute = location.pathname === "/";

  return (
    <>
      <div className="flex items-center gap-2">
        {userHasRole(user, "admin") || userHasRole(user, "staff") ? (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{user?.name ?? user?.username ?? "User"}</span>
            <Form method="post" action="/logout">
              <button type="submit" className="w-full text-left">
                Log out
              </button>
            </Form>
          </div>
        ) : (
          !isAdminRoute && (
            <AuthSection
              user={user}
              isHomeRoute={isHomeRoute}
              onProfileOpen={() => setIsProfileOpen(true)}
            />
          )
        )}
      </div>
      {/* Only render ProfileForm on desktop - mobile uses MobileProfileSheet */}
      {isProfileOpen && (
        <div className="hidden md:block">
          <ProfileFormModal onOpenChange={setIsProfileOpen} user={user} />
        </div>
      )}
    </>
  );
}
