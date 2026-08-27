import { useRef } from "react";
import { Form, Link, useNavigation } from "react-router";

import { isLogoutFormAction } from "~/auth/logout-navigation";
import { getUserInitials, type User } from "~/auth/user";
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
import { cn } from "~/lib/utils";

export function UserNav({
  user,
  isTransparent = false,
}: {
  readonly user: User | null;
  readonly isTransparent?: boolean;
}) {
  const logoutFormRef = useRef<HTMLFormElement>(null);
  const navigation = useNavigation();
  const isLoggingOut = navigation.formMethod != null && isLogoutFormAction(navigation.formAction);

  if (user == null) {
    return (
      <Button
        asChild
        variant="outline"
        size="sm"
        className={cn(
          "h-9 transition-colors duration-300",
          isTransparent &&
            "border-white/40 bg-white/20 text-white hover:bg-white/30 hover:text-white",
        )}
      >
        <Link to="/auth">Register or Log in</Link>
      </Button>
    );
  }

  const displayName = user.name ?? user.email;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            aria-label="Open profile menu"
            className={cn(
              "relative flex h-8 w-8 items-center justify-center rounded-full border capitalize italic transition-colors duration-300 md:hover:bg-transparent",
              isTransparent
                ? "border-white/60 text-white hover:border-white"
                : "border-gray-300 text-gray-900",
            )}
          >
            {getUserInitials(user)}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-auto min-w-32">
          <DropdownMenuLabel className="px-2 py-1.5 font-normal text-foreground">
            <div className="flex flex-col space-y-1">
              <p className="text-sm leading-none font-medium">{displayName}</p>
              <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem asChild className="px-2 py-1.5">
              <Link to="/profile" prefetch="intent">
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="px-2 py-1.5">
              <Link to="/bookings" prefetch="intent">
                Bookings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="px-2 py-1.5">
              <Link to="/referrals" prefetch="intent">
                Referrals
              </Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="px-2 py-1.5"
            disabled={isLoggingOut}
            onSelect={(event) => {
              event.preventDefault();
              logoutFormRef.current?.requestSubmit();
            }}
          >
            {isLoggingOut ? "Logging out…" : "Log out"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Form ref={logoutFormRef} method="post" action="/logout" hidden />
    </>
  );
}
