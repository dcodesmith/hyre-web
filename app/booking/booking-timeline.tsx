import { Calendar } from "lucide-react";
import { DetailCard, DetailCardBody, DetailCardHeader } from "~/booking/booking-detail-card";
import type { BookingLegStatusKind, BookingLegView } from "~/booking/booking-domain";
import { cn } from "~/lib/utils";

const LEG_STATUS_CLASS = {
  cancelled: "bg-red-50 text-red-700 border-red-200",
  active: "bg-blue-50 text-blue-700 border-blue-200",
  completed: "bg-green-50 text-green-700 border-green-200",
  upcoming: "bg-slate-50 text-slate-700 border-slate-200",
  unknown: "bg-slate-50 text-slate-700 border-slate-200",
} as const satisfies Record<BookingLegStatusKind, string>;

function TimePointRow({
  label,
  timeText,
  labelColorClassWhenStarted,
  isStarted,
}: {
  readonly label: string;
  readonly timeText: string;
  readonly labelColorClassWhenStarted: string;
  readonly isStarted: boolean;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <span
          className={cn(
            "min-w-16 text-sm font-medium",
            isStarted ? labelColorClassWhenStarted : "text-slate-400",
          )}
        >
          {label}
        </span>
        <span
          className={cn(
            "inline-flex items-center rounded-sm border px-2.5 py-0.5 text-sm font-semibold",
            !isStarted && "border-slate-200 text-slate-400",
          )}
        >
          {timeText}
        </span>
      </div>
    </div>
  );
}

function TimelineTrack({ isStarted }: { readonly isStarted: boolean }) {
  return (
    <div className="mt-1 flex flex-col items-center">
      <div className={cn("h-3 w-3 rounded-full", isStarted ? "bg-green-500" : "bg-slate-300")} />
      <div className={cn("h-8 w-px", isStarted ? "bg-slate-200" : "bg-slate-100")} />
      <div className={cn("h-3 w-3 rounded-full", isStarted ? "bg-red-500" : "bg-slate-300")} />
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
          "p-4 text-sm",
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
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h4
          className={cn(
            "text-sm font-semibold",
            leg.isStarted ? "text-slate-700" : "text-slate-400",
          )}
        >
          {leg.title}
        </h4>
        <span
          className={cn(
            "inline-flex items-center rounded-sm border px-2.5 py-0.5 text-xs font-semibold",
            LEG_STATUS_CLASS[leg.statusKind],
          )}
        >
          {leg.statusText}
        </span>
      </div>

      <div className="flex items-start gap-4">
        <TimelineTrack isStarted={leg.isStarted} />
        <div className="flex-1 space-y-3">
          <TimePointRow
            label="Pickup"
            timeText={leg.pickupTime}
            labelColorClassWhenStarted="text-green-600"
            isStarted={leg.isStarted}
          />
          <TimePointRow
            label="Drop-off"
            timeText={leg.dropoffTime}
            labelColorClassWhenStarted="text-red-600"
            isStarted={leg.isStarted}
          />
        </div>
      </div>

      {leg.showDayExtension ? (
        <DayExtensionNote leg={leg} />
      ) : (
        <p className={cn("text-sm", leg.isStarted ? "text-slate-600" : "text-slate-400")}>
          {leg.serviceTypeText}
        </p>
      )}
      {leg.showDivider ? <hr className="h-px w-full border-0 bg-border" /> : null}
    </div>
  );
}

export function BookingTimelineCard({ legs }: { readonly legs: readonly BookingLegView[] }) {
  return (
    <DetailCard>
      <DetailCardHeader>
        <Calendar className="h-5 w-5 text-blue-600" aria-hidden="true" />
        Trip Timeline
      </DetailCardHeader>
      <DetailCardBody>
        <div className="space-y-6">
          {legs.map((leg) => (
            <BookingLegTimeline key={leg.id} leg={leg} />
          ))}
        </div>
      </DetailCardBody>
    </DetailCard>
  );
}
