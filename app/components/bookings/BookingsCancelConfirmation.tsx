import type { FetcherWithComponents } from "react-router";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import type { BookingsListBooking } from "./bookings-index.types";

type BookingsCancelConfirmationProps = {
  readonly booking: BookingsListBooking;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly csrfToken: string;
  readonly fetcher: FetcherWithComponents<unknown>;
};

export function BookingsCancelConfirmation({
  booking,
  open,
  onOpenChange,
  csrfToken,
  fetcher,
}: BookingsCancelConfirmationProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-center font-semibold">
            Are you sure you want to cancel?
          </DialogTitle>
          <DialogDescription className="text-center pt-2 text-sm">
            This action cannot be undone. This will permanently cancel your booking for the{" "}
            <span className="font-medium">
              {booking.car.make} {booking.car.model}
            </span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-row justify-end gap-2 sm:justify-end">
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
            No
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              fetcher.submit(
                {
                  bookingId: booking.id,
                  reason: "User requested cancellation",
                  csrf: csrfToken,
                },
                {
                  method: "DELETE",
                  action: `/bookings/${booking.id}`,
                },
              );
              onOpenChange(false);
            }}
          >
            Yes, Cancel Booking
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
