import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { CalendarIcon, PlusCircleIcon, TagIcon, Trash2Icon } from "lucide-react";
import { Form, Link, useFetcher, useLocation, useNavigate, useNavigation } from "react-router";

import type { FleetCar } from "~/api/fleet/cars/schema";
import type { FleetOwnerPromotion } from "~/api/fleet/promotions/schema";
import { FormError } from "~/components/forms/form-primitives";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import { cn } from "~/lib/utils";
import { formatPromotionDateRange, getPromotionStatus, type PromotionStatus } from "./promotion";
import {
  createPromotionFormSchema,
  MAX_PROMOTION_PERCENTAGE,
  type PromotionActionData,
} from "./promotion-form-schema";

type PromotionCarOption = Pick<FleetCar, "id" | "make" | "model" | "year" | "registrationNumber">;

type FleetPromotionsPageProps = {
  readonly actionData?: PromotionActionData;
  readonly cars: readonly PromotionCarOption[];
  readonly now: string;
  readonly promotions: FleetOwnerPromotion[];
};

const promotionStatusConfig: Readonly<
  Record<PromotionStatus, { readonly label: string; readonly className: string }>
> = {
  active: { label: "Active", className: "bg-green-50 text-green-700 ring-green-600/10" },
  upcoming: { label: "Upcoming", className: "bg-blue-50 text-blue-700 ring-blue-600/10" },
  expired: { label: "Expired", className: "bg-gray-50 text-gray-600 ring-gray-500/10" },
  inactive: { label: "Inactive", className: "bg-red-50 text-red-600 ring-red-500/10" },
};

function PromotionStatusBadge({ status }: { readonly status: PromotionStatus }) {
  const config = promotionStatusConfig[status];

  return (
    <Badge
      variant="outline"
      className={cn(
        "h-6 shrink-0 rounded-md border-none px-2.5 leading-none font-semibold ring-1 ring-inset",
        config.className,
      )}
    >
      {config.label}
    </Badge>
  );
}

function PromotionCard({
  now,
  promotion,
}: {
  readonly now: string;
  readonly promotion: FleetOwnerPromotion;
}) {
  const fetcher = useFetcher<PromotionActionData>();
  const isDeactivating = fetcher.state !== "idle";
  const status = getPromotionStatus(promotion, now);
  const title = promotion.name ?? "Promotion";
  const deactivateFormId = `deactivate-${promotion.id}`;

  return (
    <Card size="sm">
      <CardHeader className="pr-14">
        <CardTitle className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 truncate">{title}</span>
          <span className="font-semibold">{promotion.discountValue}% off</span>
          <PromotionStatusBadge status={status} />
        </CardTitle>
        {promotion.isActive ? (
          <CardAction>
            <fetcher.Form id={deactivateFormId} method="post">
              <input type="hidden" name="intent" value="deactivate" />
              <input type="hidden" name="promotionId" value={promotion.id} />
            </fetcher.Form>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive hover:text-destructive"
                  disabled={isDeactivating}
                  aria-label={`Deactivate ${title}`}
                >
                  <Trash2Icon />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Deactivate {title}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This promotion will stop applying to new bookings. You cannot reactivate it.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction type="submit" form={deactivateFormId} variant="destructive">
                    Deactivate
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="font-medium">
          {promotion.car
            ? `${promotion.car.make} ${promotion.car.model} (${promotion.car.registrationNumber})`
            : "All cars"}
        </p>
        <p className="flex items-center gap-1.5 text-muted-foreground">
          <CalendarIcon className="size-4 shrink-0" aria-hidden="true" />
          <span>{formatPromotionDateRange(promotion)}</span>
        </p>
        {fetcher.data?.error ? (
          <p role="alert" className="text-sm text-destructive">
            {fetcher.data.error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CreatePromotionForm({
  cars,
  lastResult,
}: {
  readonly cars: readonly PromotionCarOption[];
  readonly lastResult?: PromotionActionData["submission"];
}) {
  const navigation = useNavigation();
  const isCreating = navigation.state !== "idle" && navigation.formData?.get("intent") === "create";
  const [form, fields] = useForm({
    id: "create-promotion",
    lastResult,
    constraint: getZodConstraint(createPromotionFormSchema),
    shouldValidate: "onSubmit",
    shouldRevalidate: "onInput",
    defaultValue: { target: "FLEET" },
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: createPromotionFormSchema });
    },
  });

  return (
    <Form
      method="post"
      action="/fleet-owner/promotions?create=1"
      {...getFormProps(form)}
      className="space-y-5"
    >
      <input type="hidden" name="intent" value="create" />

      <div className="space-y-2">
        <Label htmlFor={fields.name.id}>Promotion name (optional)</Label>
        <Input
          {...getInputProps(fields.name, { type: "text" })}
          placeholder="e.g. Easter Special"
        />
        <FormError id={fields.name.errorId} errors={fields.name.errors} />
      </div>

      <div className="space-y-2">
        <Label htmlFor={fields.target.id}>Apply to</Label>
        <Select
          key={fields.target.key}
          name={fields.target.name}
          defaultValue={fields.target.initialValue ?? "FLEET"}
        >
          <SelectTrigger
            id={fields.target.id}
            className="w-full"
            aria-invalid={fields.target.errors ? true : undefined}
            aria-describedby={fields.target.errors ? fields.target.errorId : undefined}
          >
            <SelectValue placeholder="Select target" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="FLEET">All cars</SelectItem>
            {cars.map((car) => (
              <SelectItem key={car.id} value={car.id}>
                {car.make} {car.model} {car.year} ({car.registrationNumber})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FormError id={fields.target.errorId} errors={fields.target.errors} />
      </div>

      <div className="space-y-2">
        <Label htmlFor={fields.discountValue.id}>Discount (%)</Label>
        <Input
          {...getInputProps(fields.discountValue, { type: "number" })}
          min={1}
          max={MAX_PROMOTION_PERCENTAGE}
          step="any"
          placeholder="e.g. 10"
        />
        <FormError id={fields.discountValue.errorId} errors={fields.discountValue.errors} />
        <p className="text-xs text-muted-foreground">
          Maximum {MAX_PROMOTION_PERCENTAGE}%. Applied to all booking types.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 min-[400px]:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={fields.startDate.id}>Start date</Label>
          <Input {...getInputProps(fields.startDate, { type: "date" })} />
          <FormError id={fields.startDate.errorId} errors={fields.startDate.errors} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={fields.endDate.id}>End date (inclusive)</Label>
          <Input {...getInputProps(fields.endDate, { type: "date" })} />
          <FormError id={fields.endDate.errorId} errors={fields.endDate.errors} />
        </div>
      </div>

      <FormError id={form.errorId} errors={form.errors} />

      <Button type="submit" className="w-full" disabled={isCreating}>
        {isCreating ? "Creating…" : "Create promotion"}
      </Button>
    </Form>
  );
}

export function FleetPromotionsPage({
  actionData,
  cars,
  now,
  promotions,
}: FleetPromotionsPageProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isCreateOpen = new URLSearchParams(location.search).get("create") === "1";
  const createSubmission = actionData?.intent === "create" ? actionData.submission : undefined;

  return (
    <section aria-labelledby="fleet-promotions-heading">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="fleet-promotions-heading" className="text-2xl font-semibold tracking-tight">
            Promotions
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create discounts for individual cars or your entire fleet.
          </p>
        </div>

        <Sheet
          open={isCreateOpen}
          onOpenChange={(open) => {
            if (!open) {
              void navigate("/fleet-owner/promotions", { replace: true });
            }
          }}
        >
          <SheetTrigger asChild>
            <Button asChild className="w-full sm:w-auto">
              <Link to="?create=1" preventScrollReset>
                <PlusCircleIcon data-icon="inline-start" />
                New promotion
              </Link>
            </Button>
          </SheetTrigger>
          <SheetContent className="w-full overflow-y-auto sm:max-w-md">
            <SheetHeader className="pr-12">
              <SheetTitle>Create promotion</SheetTitle>
              <SheetDescription>
                Set up a discount for your fleet or a specific car.
              </SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-4">
              <CreatePromotionForm cars={cars} lastResult={createSubmission} />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {promotions.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {promotions.map((promotion) => (
            <PromotionCard key={promotion.id} now={now} promotion={promotion} />
          ))}
        </div>
      ) : (
        <Empty className="min-h-80 border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TagIcon />
            </EmptyMedia>
            <EmptyTitle>No promotions yet</EmptyTitle>
            <EmptyDescription>
              Create your first promotion to attract more bookings.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </section>
  );
}
