import { CalendarClock } from "lucide-react";
import { NavLink } from "react-router";

import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";

export function BookingExtendCard({ bookingId }: { readonly bookingId: string }) {
  return (
    <Card className="rounded">
      <CardContent>
        <Button asChild className="w-full">
          <NavLink to={`/bookings/${encodeURIComponent(bookingId)}/extend`}>
            {({ isPending }) => (
              <>
                <CalendarClock aria-hidden="true" />
                {isPending ? "Opening extension…" : "Extend Trip"}
              </>
            )}
          </NavLink>
        </Button>
      </CardContent>
    </Card>
  );
}
