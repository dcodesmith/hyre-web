import { cn } from "cn";
import { Calendar } from "lucide-react";
import { NavLink } from "react-router";
import {
  ConnectedStops,
  DetailCard,
  DetailCardBody,
  DetailCardHeader,
  DetailCardIcon,
} from "~/booking/booking-detail-card";
import type { BookingLegStatusKind, BookingLegView } from "~/booking/booking-domain";
import { Button } from "~/components/ui/button";

const LEG_STATUS_CLASS = {
  cancelled: "bg-red-50 text-red-700 border-red-200",
  active: "bg-blue-50 text-blue-700 border-blue-200",
  completed: "bg-green-50 text-green-700 border-green-200",
  upcoming: "bg-slate-50 text-slate-700 border-slate-200",
  unknown: "bg-slate-50 text-slate-700 border-slate-200",
} as const satisfies Record<BookingLegStatusKind, string>;

function TimePoint({
  label,
  timeText,
  labelClassName,
  extended = false,
  muted = false,
}: {
  readonly label: string;
  readonly timeText: string;
  readonly labelClassName: string;
  readonly extended?: boolean;
  readonly muted?: boolean;
}) {
  return (
    <div className="flex h-6 items-center gap-2">
      <span className={cn("w-16 shrink-0 text-sm leading-5 font-medium", labelClassName)}>
        {label}
      </span>
      <span
        className={cn(
          "inline-flex h-6 items-center rounded border px-1 text-sm leading-none",
          extended
            ? cn(
                "px-2.5 font-semibold",
                muted ? "border-slate-200 text-slate-400" : "border-gray-300 text-gray-900",
              )
            : "border-gray-300 font-normal text-gray-500",
        )}
      >
        {timeText}
      </span>
    </div>
  );
}

function DayExtensionNote({ leg }: { readonly leg: BookingLegView }) {
  return (
    <div
      className={cn(
        "rounded-sm border",
        leg.isStarted ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-100",
      )}
    >
      <p
        className={cn(
          "p-4 text-sm leading-5",
          leg.isStarted ? "text-amber-800" : "text-slate-600 line-through",
        )}
      >
        Your drop-off time
        {leg.isStarted ? " has been" : " was"} extended by {leg.extendedDuration}{" "}
        {leg.extendedDuration === 1 ? "hour" : "hours"} from {leg.extensionFrom} to{" "}
        {leg.extensionTo}
      </p>
    </div>
  );
}

function BookingLegTimeline({ leg }: { readonly leg: BookingLegView }) {
  const pickupLabelClass = leg.isStarted ? "text-green-600" : "text-gray-500";
  const dropoffLabelClass = leg.isStarted ? "text-red-600" : "text-gray-500";

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm leading-6 font-medium text-gray-900">{leg.title}</h3>
        {leg.statusKind === "upcoming" ? null : (
          <span
            className={cn(
              "inline-flex items-center rounded-sm border px-2.5 py-0.5 text-xs font-semibold",
              LEG_STATUS_CLASS[leg.statusKind],
            )}
          >
            {leg.statusText}
          </span>
        )}
      </div>

      <ConnectedStops
        anchorClassName="h-6"
        lineClassName="-my-1.5"
        firstDotClassName={leg.isStarted ? "bg-green-500" : "bg-gray-300"}
        secondDotClassName={leg.isStarted ? "bg-red-500" : "bg-gray-300"}
        first={
          <TimePoint label="Pickup" timeText={leg.pickupTime} labelClassName={pickupLabelClass} />
        }
        second={
          <TimePoint
            label="Drop-off"
            timeText={leg.dropoffTime}
            labelClassName={dropoffLabelClass}
            extended={leg.showDayExtension}
            muted={!leg.isStarted}
          />
        }
      />

      {leg.showDayExtension ? (
        <DayExtensionNote leg={leg} />
      ) : (
        <p className="text-sm leading-5 text-gray-500">{leg.serviceTypeText}</p>
      )}
    </div>
  );
}

export function BookingTimelineCard({
  legs,
  extendPath,
}: {
  readonly legs: readonly BookingLegView[];
  readonly extendPath?: string;
}) {
  return (
    <DetailCard>
      <DetailCardHeader>
        <DetailCardIcon>
          <Calendar aria-hidden="true" />
        </DetailCardIcon>
        Trip Timeline
      </DetailCardHeader>
      <DetailCardBody>
        <div className="space-y-4">
          {legs.map((leg, index) => (
            <div key={leg.id} className={cn(index > 0 && "border-t border-gray-200 pt-4")}>
              <BookingLegTimeline leg={leg} />
            </div>
          ))}
        </div>
      </DetailCardBody>
      {extendPath ? (
        <div className="border-t border-gray-200 p-4">
          <Button asChild className="h-10 rounded-md px-4 shadow-sm">
            <NavLink to={extendPath}>
              {({ isPending }) => (isPending ? "Opening extension…" : "Extend Trip")}
            </NavLink>
          </Button>
        </div>
      ) : null}
    </DetailCard>
  );
}
