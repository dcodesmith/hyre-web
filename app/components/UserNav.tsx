import { Role, User } from "@prisma/client";
import { Link } from "@remix-run/react";
import { UserIcon } from "lucide-react";
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
import { userHasRole } from "~/utils/misc";
import { ProfileForm } from "./ProfileForm";

function getInitials(user: User) {
  if (!user) return "U";

  if (user.name) {
    const nameParts = user.name.trim().split(/\s+/);

    if (nameParts.length > 1) {
      return (
        nameParts[0][0] + nameParts[nameParts.length - 1][0]
      ).toUpperCase();
    }

    return nameParts[0][0].toUpperCase();
  }

  if (user.username) {
    return user.username[0].toUpperCase();
  }
}

export function UserNav({
  user,
}: {
  user: (User & { roles: Pick<Role, "name">[] }) | null;
}) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-8 w-8 rounded-full border flex items-center justify-center capitalize italic"
            >
              {user ? (
                getInitials(user)
              ) : (
                <span className="block">
                  <UserIcon className="h-5 w-5 stroke-slate-800" />
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent className="" align="end" forceMount>
            {user ? (
              <>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {user.name ?? user.username}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => setIsProfileOpen(true)}>
                    Profile
                  </DropdownMenuItem>
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
                  <Link to="/logout">Log out</Link>
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuItem>Register</DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/login">Log in</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Become a fleet owner</DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {isProfileOpen && (
        <ProfileForm onOpenChange={setIsProfileOpen} user={user} />
      )}
    </>
  );
}
