import { Form, Link, useNavigation } from "react-router";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

const chromeButtonClassName =
  "h-9 shrink-0 rounded-md px-3 text-sm transition-colors duration-300 active:translate-y-0";

export function isLogoutFormAction(formAction: string | undefined) {
  return formAction != null && new URL(formAction, "https://tripdly.com").pathname === "/logout";
}

export function UserNav({
  user,
  isTransparent = false,
}: {
  readonly user: boolean;
  readonly isTransparent?: boolean;
}) {
  const navigation = useNavigation();
  const isLoggingOut = navigation.formMethod != null && isLogoutFormAction(navigation.formAction);
  const className = cn(
    chromeButtonClassName,
    isTransparent && "border-white/40 bg-white/20 text-white hover:bg-white/30 hover:text-white",
  );

  if (!user) {
    return (
      <Button asChild variant="outline" size="sm" className={className}>
        <Link to="/auth">Register or Log in</Link>
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button asChild variant="outline" size="sm" className={className}>
        <Link to="/bookings" prefetch="intent">
          Bookings
        </Link>
      </Button>
      <Form method="post" action="/logout">
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={isLoggingOut}
          aria-label={isLoggingOut ? "Logging out" : "Log out"}
          className={className}
        >
          {isLoggingOut ? "Logging out…" : "Log out"}
        </Button>
      </Form>
    </div>
  );
}
