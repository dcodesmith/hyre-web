import { format, toZonedTime } from "date-fns-tz";
import { ChevronRight } from "lucide-react";
import { Fragment } from "react";
import type { FetcherWithComponents } from "react-router";
import { Link, useNavigate } from "react-router";
import { AutocompleteAddress } from "~/components/AutocompleteAddress";
import { BookingTimeSelect } from "~/components/booking/BookingTimeSelect";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { formatCurrency, getLegExtendableDuration, isBookingEditable } from "~/lib/utils";
import type { BookingsListBooking } from "./bookings-index.types";

const LAGOS_TZ = "Africa/Lagos";

const STATUSES = ["ACTIVE", "CONFIRMED", "COMPLETED", "CANCELLED"] as const;

type BookingsTabsSectionProps = {
  readonly bookings: Partial<Record<(typeof STATUSES)[number], BookingsListBooking[]>> | null;
  readonly currentStatus: string;
  readonly searchParams: URLSearchParams;
  readonly fetcher: FetcherWithComponents<unknown>;
  readonly editFetcher: FetcherWithComponents<{ success: boolean }>;
  readonly activeEditBookingId: string | null;
  readonly setActiveEditBookingId: (bookingId: string | null) => void;
  readonly showDropoffByBookingId: Record<string, boolean>;
  readonly setShowDropoffForBooking: (bookingId: string, show: boolean) => void;
  readonly onRequestCancel: (booking: BookingsListBooking) => void;
};

export function BookingsTabsSection({
  bookings,
  currentStatus,
  searchParams,
  fetcher,
  editFetcher,
  activeEditBookingId,
  setActiveEditBookingId,
  showDropoffByBookingId,
  setShowDropoffForBooking,
  onRequestCancel,
}: BookingsTabsSectionProps) {
  const navigate = useNavigate();

  return (
    <Tabs defaultValue={currentStatus} className="w-full">
      <TabsList className="flex overflow-x-auto bg-white justify-start space-x-4 p-0">
        {STATUSES.map((tabStatus) => (
          <TabsTrigger
            className="whitespace-nowrap gap-1 antialiased rounded border data-[state=active]:border-primary data-[state=active]:border-1"
            key={tabStatus}
            value={tabStatus}
            onClick={() => {
              const newSearchParams = new URLSearchParams(searchParams);
              newSearchParams.set("status", tabStatus.toLowerCase());
              navigate(`/bookings?${newSearchParams.toString()}`);
            }}
          >
            {tabStatus.charAt(0) + tabStatus.slice(1).toLowerCase()}
            <span>({bookings?.[tabStatus]?.length || 0})</span>
          </TabsTrigger>
        ))}
      </TabsList>

      {STATUSES.map((tabStatus) => (
        <TabsContent
          className="shadow-md border border-gray-200 transition-shadow rounded"
          key={tabStatus}
          value={tabStatus}
        >
          <div className="flex flex-col">
            {bookings?.[tabStatus]?.map((booking) => {
              const isThisBookingBeingCancelled =
                fetcher.state !== "idle" && fetcher.formData?.get("bookingId") === booking.id;
              const showDropoffFields =
                showDropoffByBookingId[booking.id] ??
                booking.pickupLocation !== booking.returnLocation;

              const linkClassName = isThisBookingBeingCancelled
                ? "flex items-center gap-4 w-full pointer-events-none"
                : "flex items-center gap-4 w-full";
              return (
                <Fragment key={booking.id}>
                  <div className="sm:flex-row flex-col flex justify-between px-2 py-4 border-b last:border-0">
                    <Link to={`/bookings/${booking.id}`} className={linkClassName}>
                      <img
                        src={booking.car.images[0].url}
                        alt={`${booking.car.make} ${booking.car.model}`}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-pretty text-sm font-semibold">
                            {booking.car.make} {booking.car.model} ({booking.car.year}) -{" "}
                            <span className="text-gray-500 italic">{booking.bookingReference}</span>
                          </h3>
                          {booking.status === "COMPLETED" && (
                            <Badge
                              variant="outline"
                              className={`text-xs rounded-sm ${
                                booking.review
                                  ? "bg-green-50 text-green-700 border-green-200"
                                  : "bg-amber-50 text-amber-700 border-amber-200"
                              }`}
                            >
                              {booking.review ? "Reviewed" : "Review Pending"}
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-pretty text-gray-600 space-y-1">
                          <p className="sm:block hidden">
                            {format(toZonedTime(new Date(booking.startDate), LAGOS_TZ), "PPPp")} to{" "}
                            {format(toZonedTime(new Date(booking.endDate), LAGOS_TZ), "PPPp")}
                          </p>

                          <p className="sm:hidden block">
                            {format(toZonedTime(new Date(booking.startDate), LAGOS_TZ), "PPPp")}
                          </p>
                          <p className="sm:hidden block">
                            {format(toZonedTime(new Date(booking.endDate), LAGOS_TZ), "PPPp")}
                          </p>

                          <p className="text-pretty text-sm font-semibold">
                            {formatCurrency(Number(booking.totalAmount))}
                          </p>
                        </div>
                      </div>
                    </Link>

                    <div className="flex sm:flex-row flex-col gap-2 sm:mt-0 mt-2 items-center justify-center">
                      {getLegExtendableDuration(
                        booking as unknown as Parameters<typeof getLegExtendableDuration>[0],
                      ) > 0 && (
                        <Link
                          to={`/bookings/${booking.id}/extend`}
                          className="bg-green-700 hover:bg-green-800 p-2 border text-white rounded text-center sm:w-auto w-full transition duration-300 ease-in-out"
                        >
                          Extend
                        </Link>
                      )}

                      {booking.status === "CONFIRMED" &&
                        isBookingEditable(new Date(booking.startDate)) && (
                          <Dialog
                            open={activeEditBookingId === booking.id}
                            onOpenChange={(open) => {
                              setActiveEditBookingId(open ? booking.id : null);
                            }}
                          >
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                className="sm:w-auto w-full bg-gray-100"
                                disabled={isThisBookingBeingCancelled}
                              >
                                Modify Booking
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[425px]">
                              <DialogHeader>
                                <DialogTitle>
                                  {booking.car.make} {booking.car.model} {booking.car.year}
                                </DialogTitle>
                                <DialogDescription>
                                  {booking.type === "DAY"
                                    ? "Edit the pickup time, pickup address, and drop-off address"
                                    : "Edit the pickup time and pickup address"}
                                </DialogDescription>
                              </DialogHeader>
                              <editFetcher.Form
                                method="PATCH"
                                action={`/bookings/${booking.id}`}
                                className="space-y-4"
                                key={booking.id}
                              >
                                <input type="hidden" name="bookingId" value={booking.id} />
                                <div className="grid gap-4 py-4">
                                  {booking.type === "DAY" && (
                                    <div className="space-y-2">
                                      <label htmlFor="pickupTime" className="text-sm font-medium">
                                        Pickup Time
                                      </label>
                                      <BookingTimeSelect
                                        date={new Date(booking.startDate)}
                                        defaultValue={new Date(
                                          booking.startDate,
                                        ).toLocaleTimeString("en-US", {
                                          hour: "numeric",
                                          minute: "numeric",
                                          hour12: true,
                                        })}
                                      />
                                    </div>
                                  )}

                                  <div className="space-y-2">
                                    <label htmlFor="pickupAddress" className="text-sm font-medium">
                                      Pickup Address
                                    </label>
                                    <AutocompleteAddress
                                      id="pickupAddress"
                                      inputProps={{
                                        name: "pickupAddress",
                                        placeholder: "Enter pickup address",
                                      }}
                                      onSelect={() => {}}
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <div className="flex items-center space-x-2">
                                      <Checkbox
                                        id="sameLocation"
                                        name="sameLocation"
                                        defaultChecked={
                                          booking.pickupLocation === booking.returnLocation
                                        }
                                        onCheckedChange={(checked) =>
                                          setShowDropoffForBooking(booking.id, checked !== true)
                                        }
                                      />
                                      <Label htmlFor="sameLocation">
                                        Drop-off location same as pickup
                                      </Label>
                                    </div>
                                  </div>

                                  {showDropoffFields && (
                                    <div className="space-y-2">
                                      <label
                                        htmlFor="dropOffAddress"
                                        className="text-sm font-medium"
                                      >
                                        Drop-off Address
                                      </label>
                                      <AutocompleteAddress
                                        id="dropOffAddress"
                                        inputProps={{
                                          name: "dropOffAddress",
                                          placeholder: "Enter drop-off address",
                                        }}
                                        onSelect={() => {}}
                                      />
                                    </div>
                                  )}
                                </div>

                                <div className="flex justify-end gap-3">
                                  <Button
                                    variant="outline"
                                    type="button"
                                    onClick={() => setActiveEditBookingId(null)}
                                  >
                                    Cancel
                                  </Button>
                                  <Button type="submit">Save Changes</Button>
                                </div>
                              </editFetcher.Form>
                            </DialogContent>
                          </Dialog>
                        )}

                      {["PENDING", "CONFIRMED"].includes(booking.status) &&
                        isBookingEditable(new Date(booking.startDate)) && (
                          <Button
                            variant="destructive"
                            className="sm:w-auto w-full"
                            onClick={() => onRequestCancel(booking)}
                            disabled={isThisBookingBeingCancelled}
                          >
                            {isThisBookingBeingCancelled ? "Cancelling..." : "Cancel Booking"}
                          </Button>
                        )}

                      <ChevronRight className="w-4 h-4 text-gray-500 sm:block hidden" />
                    </div>
                  </div>
                </Fragment>
              );
            })}
            {(!bookings?.[tabStatus] || bookings?.[tabStatus]?.length === 0) && (
              <div className="text-center py-8 text-gray-500">
                No {tabStatus.toLowerCase()} bookings
              </div>
            )}
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
